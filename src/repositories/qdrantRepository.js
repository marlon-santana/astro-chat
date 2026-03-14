const fs = require("fs");
const path = require("path");
const { embeddingService } = require("../services/embeddingService");

const COLLECTION = process.env.QDRANT_COLLECTION || "docs";
const QDRANT_URL = process.env.QDRANT_URL || null;

function baseUrl() {
  if (!QDRANT_URL) return null;
  return QDRANT_URL.replace(/\/$/, "");
}

async function ensureCollection(dimension) {
  const url = baseUrl();
  if (!url) return false;
  const endpoint = `${url}/collections/${encodeURIComponent(COLLECTION)}`;
  const hnswM = parseInt(process.env.QDRANT_HNSW_M || "16", 10);
  const efConstruct = parseInt(
    process.env.QDRANT_HNSW_EF_CONSTRUCT || "200",
    10,
  );
  const body = {
    vectors: { size: dimension, distance: "Cosine" },
    hnsw_config: { m: hnswM, ef_construct: efConstruct },
  };
  try {
    const res = await fetch(endpoint, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn("ensureCollection failed:", res.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(
      "ensureCollection error:",
      err && err.message ? err.message : err,
    );
    return false;
  }
}

async function upsertFromIndex(indexPath) {
  const url = baseUrl();
  if (!url) throw new Error("QDRANT_URL not configured");
  if (!fs.existsSync(indexPath)) throw new Error("index.json not found");
  const raw = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const docs = raw.docs || raw;
  if (!docs || docs.length === 0) return { upserted: 0 };
  const dimension =
    docs[0].meta && docs[0].meta.embedding
      ? docs[0].meta.embedding.length
      : null;
  if (!dimension) throw new Error("Embeddings missing in index");

  await ensureCollection(dimension);

  const points = docs.map((d, i) => ({
    id: i,
    vector: d.meta.embedding,
    payload: {
      content: d.content,
      source: d.source || (d.meta && d.meta.source) || null,
    },
  }));

  const chunkSize = 128;
  for (let i = 0; i < points.length; i += chunkSize) {
    const slice = points.slice(i, i + chunkSize);
    const endpoint = `${url}/collections/${encodeURIComponent(COLLECTION)}/points?wait=true`;
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ points: slice }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Qdrant upsert failed: ${res.status} ${t}`);
      }
    } catch (err) {
      console.warn(
        "upsert chunk failed:",
        err && err.message ? err.message : err,
      );
      throw err;
    }
  }

  return { upserted: points.length };
}

async function search(queryVec, topK = 5) {
  const url = baseUrl();
  if (!url) return null;
  const endpoint = `${url}/collections/${encodeURIComponent(COLLECTION)}/points/search`;
  const searchEf = parseInt(process.env.QDRANT_SEARCH_EF || "128", 10);
  const body = {
    vector: queryVec,
    limit: topK,
    with_payload: true,
    params: { hnsw_ef: searchEf },
  };
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      console.warn("Qdrant search failed:", res.status, t);
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data.result)) return null;
    return data.result.map((r) => ({ ...r.payload, score: r.score, id: r.id }));
  } catch (err) {
    console.warn(
      "Qdrant search error:",
      err && err.message ? err.message : err,
    );
    return null;
  }
}

module.exports = {
  qdrantRepository: { upsertFromIndex, search, ensureCollection },
};
