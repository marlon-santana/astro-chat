const DEFAULT_EMBED_URL = "http://localhost:11434/api/embed";

function resolveEmbedUrl() {
  const raw =
    process.env.OLLAMA_EMBEDDING_URL ||
    process.env.OLLAMA_URL ||
    DEFAULT_EMBED_URL;

  try {
    const u = new URL(raw);
    if (u.pathname.includes("/api/")) {
      return `${u.origin}/api/embed`;
    }
    return `${u.origin}${u.pathname.replace(/\/$/, "")}/api/embed`;
  } catch {
    return DEFAULT_EMBED_URL;
  }
}

function resolveFallbackUrl() {
  const raw = process.env.OLLAMA_EMBEDDING_FALLBACK_URL || DEFAULT_EMBED_URL;
  try {
    const u = new URL(raw);
    if (u.pathname.includes("/api/")) {
      return `${u.origin}/api/embed`;
    }
    return `${u.origin}${u.pathname.replace(/\/$/, "")}/api/embed`;
  } catch {
    return DEFAULT_EMBED_URL;
  }
}

function resolveCohereUrl() {
  const raw = process.env.COHERE_EMBED_URL || "https://api.cohere.ai/v1/embed";
  try {
    const u = new URL(raw);
    return u.toString();
  } catch {
    return "https://api.cohere.ai/v1/embed";
  }
}

function getCohereApiKey() {
  return process.env.COHERE_API_KEY || "";
}

function getEmbeddingModel() {
  return process.env.OLLAMA_EMBEDDING_MODEL || "embeddinggemma";
}

function getEmbeddingApiKey() {
  return (
    process.env.OLLAMA_EMBEDDING_API_KEY ||
    process.env.OLLAMA_API_KEY ||
    process.env.LLAMA_CLOUD_KEY ||
    ""
  );
}

function normalizeVector(vec) {
  if (!Array.isArray(vec) || vec.length === 0) return vec;
  let sum = 0;
  for (const v of vec) sum += v * v;
  const norm = Math.sqrt(sum);
  if (!norm) return vec;
  return vec.map((v) => v / norm);
}

const crypto = require("crypto");
const DEFAULT_EMBED_DIM = Number(process.env.EMBED_DIM || 384);

function deterministicVectorFromText(text, dim = DEFAULT_EMBED_DIM) {
  const parts = Math.ceil(dim / 32);
  const buf = Buffer.alloc(parts * 32);
  for (let i = 0; i < parts; i++) {
    const h = crypto
      .createHash("sha256")
      .update(String(text) + "|" + i)
      .digest();
    h.copy(buf, i * 32);
  }

  const vec = new Array(dim);
  for (let i = 0; i < dim; i++) {
    const off = (i * 4) % buf.length;
    const v = buf.readUInt32BE(off);
    // map uint32 -> float in range [-1,1]
    vec[i] = (v / 0xffffffff) * 2 - 1;
  }
  return normalizeVector(vec);
}

async function requestEmbeddings(url, model, input, apiKey) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      input,
    }),
  });

  if (!response.ok) {
    const err = new Error(`Embedding HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  if (data && Array.isArray(data.embeddings)) {
    return data.embeddings.map(normalizeVector);
  }
  if (data && Array.isArray(data.embedding)) {
    return data.embedding.map(normalizeVector);
  }
  throw new Error("Resposta de embedding invalida.");
}

async function requestCohereEmbeddings(url, model, input, apiKey) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: model || process.env.COHERE_EMBED_MODEL || "embed-english-v2.0",
      texts: input,
    }),
  });

  if (!response.ok) {
    const err = new Error(`Cohere Embedding HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  if (data && Array.isArray(data.embeddings)) {
    return data.embeddings.map(normalizeVector);
  }
  throw new Error("Resposta de embedding Cohere invalida.");
}

async function embedBatch(texts) {
  const input = Array.isArray(texts) ? texts : [texts];
  if (input.length === 0) return [];
  // configurable retry options
  const RETRY_COUNT = Number(process.env.EMBED_RETRY_COUNT || 2);
  const RETRY_DELAY_MS = Number(process.env.EMBED_RETRY_DELAY_MS || 500);

  function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  async function callWithRetries(
    fn,
    args = [],
    attempts = RETRY_COUNT,
    delay = RETRY_DELAY_MS,
  ) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn(...args);
      } catch (err) {
        lastErr = err;
        const backoff = delay * Math.pow(2, i);
        console.warn(
          `Embedding call failed (attempt ${i + 1}/${attempts}):`,
          err && err.message ? err.message : err,
        );
        if (i < attempts - 1) await sleep(backoff);
      }
    }
    throw lastErr;
  }

  // Prefer Cohere if API key present — when configured, do NOT call other providers
  const cohereKey = getCohereApiKey();
  if (cohereKey) {
    const cohereUrl = resolveCohereUrl();
    const cohereModel = process.env.COHERE_EMBED_MODEL || "embed-english-v2.0";
    try {
      return await callWithRetries(requestCohereEmbeddings, [
        cohereUrl,
        cohereModel,
        input,
        cohereKey,
      ]);
    } catch (err) {
      console.warn(
        "Cohere embed call failed after retries; not falling back to OLLAMA because COHERE_API_KEY is configured:",
        err && err.message ? err.message : err,
      );
      // Final fallback: deterministic local embeddings
      try {
        console.warn(
          "Using deterministic local embeddings for",
          input.length,
          "items.",
        );
        return input.map((t) =>
          deterministicVectorFromText(t, DEFAULT_EMBED_DIM),
        );
      } catch (err3) {
        throw err;
      }
    }
  }

  const url = resolveEmbedUrl();
  const model = getEmbeddingModel();
  const apiKey = getEmbeddingApiKey();

  try {
    return await callWithRetries(requestEmbeddings, [
      url,
      model,
      input,
      apiKey,
    ]);
  } catch (err) {
    console.warn(
      "Primary embedding provider failed:",
      err && err.message ? err.message : err,
    );
    // If unauthorized, or any network error, try fallback URL if configured
    const fallbackUrl = resolveFallbackUrl();
    if (fallbackUrl && fallbackUrl !== url) {
      try {
        return await callWithRetries(requestEmbeddings, [
          fallbackUrl,
          model,
          input,
          process.env.OLLAMA_EMBEDDING_FALLBACK_API_KEY || "",
        ]);
      } catch (err2) {
        console.warn(
          "Fallback embedding provider also failed:",
          err2 && err2.message ? err2.message : err2,
        );
      }
    }

    // Final fallback: deterministic local embeddings
    try {
      console.warn(
        "Embedding endpoint unavailable, using deterministic local embeddings for",
        input.length,
        "items.",
      );
      return input.map((t) =>
        deterministicVectorFromText(t, DEFAULT_EMBED_DIM),
      );
    } catch (err3) {
      throw err;
    }
  }
}

async function embedText(text) {
  if (!text) return [];
  const [vector] = await embedBatch([text]);
  return vector || [];
}

async function checkEmbeddingService(timeoutMs = 5000) {
  const testText = "__health_check_embedding__";
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), timeoutMs),
  );

  try {
    const vec = await Promise.race([embedBatch([testText]), timeoutPromise]);
    const deterministic = deterministicVectorFromText(
      testText,
      DEFAULT_EMBED_DIM,
    );
    const got = Array.isArray(vec) && Array.isArray(vec[0]) ? vec[0] : vec;

    // compare approximately
    if (!Array.isArray(got)) {
      return { ok: false, error: "invalid_vector" };
    }
    let equal = true;
    const EPS = 1e-6;
    for (let i = 0; i < Math.min(got.length, deterministic.length); i++) {
      if (Math.abs(got[i] - deterministic[i]) > EPS) {
        equal = false;
        break;
      }
    }

    return {
      ok: true,
      provider: equal ? "deterministic" : "remote",
      dim: got.length,
    };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

module.exports = {
  embeddingService: {
    embedText,
    embedBatch,
    getEmbeddingModel,
    resolveEmbedUrl,
    resolveFallbackUrl,
    checkEmbeddingService,
  },
};
