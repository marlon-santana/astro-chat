const fs = require("fs");
const path = require("path");
const { embeddingService } = require("../services/embeddingService");

const INDEX_PATH = path.join(__dirname, "..", "..", "data", "index.json");

let qdrantRepo = null;
try {
  if (process.env.USE_QDRANT === "true" || process.env.QDRANT_URL) {
    qdrantRepo = require("./qdrantRepository").qdrantRepository;
  }
} catch (e) {
  console.warn("Qdrant client not available:", e && e.message ? e.message : e);
}

let sqliteRepo = null;
try {
  if (process.env.USE_SQLITE === "true" || process.env.SQLITE_DB_PATH) {
    sqliteRepo = require("./sqliteRepository").sqliteRepository;
  }
} catch (e) {
  console.warn("SQLite repo not available:", e && e.message ? e.message : e);
}

let cache = { meta: null, loadedAt: 0 };
const CACHE_TTL_MS = 30_000;

function loadMeta() {
  if (!fs.existsSync(INDEX_PATH)) return { meta: {}, docs: [] };
  try {
    const raw = fs.readFileSync(INDEX_PATH, "utf8");
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return { meta: {}, docs: data };
    return { meta: data.meta || {}, docs: data.docs || [] };
  } catch {
    return { meta: {}, docs: [] };
  }
}

function ensureCache() {
  const now = Date.now();
  if (cache.meta && now - cache.loadedAt < CACHE_TTL_MS) return cache;
  cache = { meta: loadMeta(), loadedAt: now };
  return cache;
}

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function fallbackTokenSearch(question, docs, topK) {
  if (!docs || docs.length === 0) return [];
  const qTokens = new Set(tokenize(question));

  const scored = docs.map((doc) => {
    const dTokens = new Set(tokenize(doc.content));
    let score = 0;
    for (const t of qTokens) {
      if (dTokens.has(t)) score += 1;
    }
    return { ...doc, score };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

async function search(question, topK = 3) {
  const { meta } = ensureCache();
  const docs = meta.docs || [];
  if (docs.length === 0) return [];

  // 1) try Qdrant
  if (qdrantRepo) {
    try {
      const qVec = await embeddingService.embedText(question);
      if (qVec && qVec.length > 0) {
        const qRes = await qdrantRepo.search(qVec, topK);
        if (qRes && qRes.length > 0) {
          if (sqliteRepo) {
            const ids = qRes.map((r) => Number(r.id));
            try {
              const docsById = sqliteRepo.getDocsByIds(ids);
              if (docsById && docsById.length > 0) {
                const scoreMap = new Map(
                  qRes.map((r) => [Number(r.id), r.score]),
                );
                return docsById.map((d) => ({
                  ...d,
                  score: scoreMap.get(d.id) || 0,
                }));
              }
            } catch (e) {
              console.warn(
                "SQLite getDocsByIds failed:",
                e && e.message ? e.message : e,
              );
            }
          }
          return qRes.map((r) => ({ ...r, score: r.score }));
        }
      }
    } catch (err) {
      console.warn(
        "Qdrant search failed, continuing fallback:",
        err && err.message ? err.message : err,
      );
    }
  }

  // 2) JS cosine fallback over stored embeddings
  const docsWithEmb = docs.filter(
    (d) =>
      d &&
      d.meta &&
      Array.isArray(d.meta.embedding) &&
      d.meta.embedding.length > 0,
  );
  if (docsWithEmb.length > 0) {
    const qVec = await embeddingService.embedText(question);
    if (qVec && qVec.length > 0) {
      const norm = (v) => {
        let s = 0;
        for (const x of v) s += x * x;
        const n = Math.sqrt(s) || 1;
        return v.map((x) => x / n);
      };
      const qn = norm(qVec);
      const scored = docsWithEmb.map((d) => {
        const v = d.meta.embedding;
        let dot = 0;
        const len = Math.min(qn.length, v.length);
        for (let i = 0; i < len; i += 1) dot += qn[i] * v[i];
        return { ...d, score: dot };
      });
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, topK);
    }
  }

  // 3) token fallback
  return fallbackTokenSearch(question, docs, topK);
}

module.exports = { vectorRepository: { search } };
