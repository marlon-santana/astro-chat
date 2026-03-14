const fs = require("fs");
const path = require("path");
const { embeddingService } = require("../services/embeddingService");

const INDEX_PATH = path.join(__dirname, "..", "..", "data", "index.json");
const FAISS_PATH = path.join(__dirname, "..", "..", "data", "index.faiss");

let faiss = null;
try {
  faiss = require("faiss-node");
} catch (err) {
  console.warn("FAISS indisponivel, usando fallback:", err.message || err);
}

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
  if (process.env.USE_SQLITE === 'true' || process.env.SQLITE_DB_PATH) {
    sqliteRepo = require('./sqliteRepository').sqliteRepository;
  }
} catch (e) {
  console.warn('SQLite repo not available:', e && e.message ? e.message : e);
}

let cache = { meta: null, faissIndex: null, loadedAt: 0 };
const CACHE_TTL_MS = 30_000;

function loadMeta() {
  if (!fs.existsSync(INDEX_PATH)) {
    return { meta: {}, docs: [] };
  }

  const raw = fs.readFileSync(INDEX_PATH, "utf8");
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      return { meta: {}, docs: data };
    }
    if (data && Array.isArray(data.docs)) {
      return { meta: data.meta || {}, docs: data.docs };
    }
    return { meta: {}, docs: [] };
  } catch {
    return { meta: {}, docs: [] };
  }
}

function loadFaissIndex() {
  if (!faiss || !fs.existsSync(FAISS_PATH)) return null;
  try {
    if (typeof faiss.read_index === "function")
      return faiss.read_index(FAISS_PATH);
    if (typeof faiss.read === "function") return faiss.read(FAISS_PATH);
    if (typeof faiss.readIndex === "function")
      return faiss.readIndex(FAISS_PATH);
    if (faiss.Index && typeof faiss.Index.read === "function")
      return faiss.Index.read(FAISS_PATH);
    if (typeof faiss.read_index_file === "function")
      return faiss.read_index_file(FAISS_PATH);
    // last resort: try requiring the file as JSON -> not a real faiss index but may contain docs
    return null;
  } catch (err) {
    console.warn("Falha ao carregar FAISS index:", err.message || err);
    return null;
  }
}

function ensureCache() {
  const now = Date.now();
  if (cache.meta && now - cache.loadedAt < CACHE_TTL_MS) {
    return cache;
  }

  cache = {
    meta: loadMeta(),
    faissIndex: loadFaissIndex(),
    loadedAt: now,
  };

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
  const { meta, faissIndex } = ensureCache();
  const docs = meta.docs || [];
  if (docs.length === 0) return [];

  if (faissIndex) {
    const vector = await embeddingService.embedText(question);
    if (!vector || vector.length === 0) {
      return fallbackTokenSearch(question, docs, topK);
    }
    // Convert to Float32Array which most bindings expect
    const qArr = Float32Array.from(vector);

    let res = null;
    try {
      if (typeof faissIndex.search === "function") {
        try {
          res = faissIndex.search(qArr, topK);
        } catch (e1) {
          try {
            // some bindings expect (n, x, k)
            res = faissIndex.search(1, qArr, topK);
          } catch (e2) {
            // some bindings return [labels, distances]
            res = faissIndex.search([Array.from(qArr)], topK);
          }
        }
      } else if (faiss && typeof faiss.search === "function") {
        res = faiss.search(faissIndex, qArr, topK);
      }
    } catch (err) {
      console.warn(
        "FAISS search failed, falling back:",
        err && err.message ? err.message : err,
      );
      res = null;
    }

    let labels = null;
    let distances = null;
    if (res) {
      if (res.labels && res.distances) {
        labels = res.labels;
        distances = res.distances;
      } else if (Array.isArray(res) && res.length >= 2) {
        // handle [labels, distances] or [[labels], [distances]]
        const maybeLabels = res[0];
        const maybeDistances = res[1];
        if (Array.isArray(maybeLabels) && Array.isArray(maybeLabels[0])) {
          labels = maybeLabels[0];
        } else {
          labels = maybeLabels;
        }
        if (Array.isArray(maybeDistances) && Array.isArray(maybeDistances[0])) {
          distances = maybeDistances[0];
        } else {
          distances = maybeDistances;
        }
      }
    }

    const out = [];
    if (Array.isArray(labels) && Array.isArray(distances)) {
      for (let i = 0; i < labels.length; i += 1) {
        const label = labels[i];
        if (label < 0 || label >= docs.length) continue;
        out.push({ ...docs[label], score: distances[i] });
      }
      if (out.length > 0) return out;
    }
  }
  // If Qdrant is enabled, try it before JS fallback
  if (qdrantRepo) {
    try {
      const qVec = await embeddingService.embedText(question);
      if (qVec && qVec.length > 0) {
        const qRes = await qdrantRepo.search(qVec, topK);
        if (qRes && qRes.length > 0) {
          // If sqliteRepo exists, use it to fetch authoritative metadata by id
          if (sqliteRepo) {
            const ids = qRes.map((r) => Number(r.id));
            try {
              const docs = sqliteRepo.getDocsByIds(ids);
              if (docs && docs.length > 0) {
                const scoreMap = new Map(qRes.map((r) => [Number(r.id), r.score]));
                return docs.map((d) => ({ ...d, score: scoreMap.get(d.id) || 0 }));
              }
            } catch (e) {
              console.warn('SQLite getDocsByIds failed:', e && e.message ? e.message : e);
            }
          }
          return qRes.map((r) => ({ ...r, score: r.score }));
        }
      }
    } catch (err) {
      console.warn(
        'Qdrant search failed, continuing fallback:',
        err && err.message ? err.message : err,
      );
    }
  }

  // If FAISS not available or returned nothing, try cosine search over stored embeddings
  // Ensure docs have embeddings
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
      // ensure normalization
      const norm = (v) => {
        let s = 0;
        for (const x of v) s += x * x;
        s = Math.sqrt(s) || 1;
        return v.map((x) => x / s);
      };

      const qn = norm(qVec);
      const scored = docsWithEmb.map((d) => {
        const v = d.meta.embedding;
        // compute dot product
        let dot = 0;
        const len = Math.min(qn.length, v.length);
        for (let i = 0; i < len; i += 1) dot += qn[i] * v[i];
        return { ...d, score: dot };
      });

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, topK);
    }
  }

  return fallbackTokenSearch(question, docs, topK);
}

module.exports = { vectorRepository: { search } };
