require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { embeddingService } = require("../services/embeddingService");

async function main() {
  const INDEX_PATH = path.join(__dirname, "..", "..", "data", "index.json");
  if (!fs.existsSync(INDEX_PATH)) {
    console.error("index.json not found");
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  const docs = raw.docs || [];
  const texts = docs.map((d) => d.content);
  console.log("Requesting embeddings for", texts.length, "documents...");
  const vectors = await embeddingService.embedBatch(texts);
  const dims = vectors[0].length;
  console.log("Embedding dims:", dims);

  let faiss = null;
  try {
    faiss = require("faiss-node");
  } catch (e) {
    console.error("faiss-node require failed:", e && e.message ? e.message : e);
    process.exit(1);
  }

  const IndexClass = faiss.IndexFlatIP || faiss.IndexFlatL2 || faiss.Index;
  if (!IndexClass) {
    console.error("No Index class available on faiss binding");
    process.exit(1);
  }

  const index = new IndexClass(dims);

  // Attempt 1: nested arrays
  try {
    console.log("\nAttempt 1: index.add(nested arrays)");
    index.add(vectors);
    console.log("Attempt 1 succeeded");
  } catch (err) {
    console.error("Attempt 1 failed:", err && err.message ? err.message : err);
  }

  // Attempt 2: array of Float32Array
  try {
    console.log("\nAttempt 2: index.add(array of Float32Array)");
    const arr = vectors.map((v) => Float32Array.from(v));
    index.add(arr);
    console.log("Attempt 2 succeeded");
  } catch (err) {
    console.error("Attempt 2 failed:", err && err.message ? err.message : err);
  }

  // Attempt 3: flattened Float32Array
  try {
    console.log("\nAttempt 3: index.add(flat Float32Array)");
    const flat = new Float32Array(vectors.length * dims);
    for (let i = 0; i < vectors.length; i++) {
      for (let j = 0; j < dims; j++) {
        flat[i * dims + j] = vectors[i][j];
      }
    }
    index.add(flat);
    console.log("Attempt 3 succeeded");
  } catch (err) {
    console.error("Attempt 3 failed:", err && err.message ? err.message : err);
  }

  // Attempt 4: faiss.search helper add if present
  try {
    if (typeof faiss.add === "function") {
      console.log("\nAttempt 4: faiss.add(index, flat)");
      const flat = new Float32Array(vectors.length * dims);
      for (let i = 0; i < vectors.length; i++) {
        for (let j = 0; j < dims; j++) flat[i * dims + j] = vectors[i][j];
      }
      faiss.add(index, flat);
      console.log("Attempt 4 succeeded");
    } else {
      console.log("\nAttempt 4: faiss.add not available, skipping");
    }
  } catch (err) {
    console.error("Attempt 4 failed:", err && err.message ? err.message : err);
  }

  // Attempt 5: flattened plain JS Array
  try {
    console.log("\nAttempt 5: index.add(flat plain JS Array)");
    const flatArr = new Array(vectors.length * dims);
    for (let i = 0; i < vectors.length; i++) {
      for (let j = 0; j < dims; j++) flatArr[i * dims + j] = vectors[i][j];
    }
    index.add(flatArr);
    console.log("Attempt 5 succeeded");
  } catch (err) {
    console.error("Attempt 5 failed:", err && err.message ? err.message : err);
  }

  // Attempt to write index to disk using various APIs
  const OUT_FAISS = path.join(__dirname, "..", "..", "data", "index.faiss");
  try {
    console.log("\nTrying to persist index to disk...");
    if (typeof faiss.write_index === "function") {
      console.log("Using faiss.write_index");
      faiss.write_index(index, OUT_FAISS);
    } else if (typeof faiss.write === "function") {
      console.log("Using faiss.write");
      faiss.write(index, OUT_FAISS);
    } else if (faiss.Index && typeof faiss.Index.write === "function") {
      console.log("Using faiss.Index.write");
      faiss.Index.write(index, OUT_FAISS);
    } else if (typeof index.write === "function") {
      console.log("Using index.write (last resort)");
      index.write(OUT_FAISS);
    } else {
      console.warn("No known write method available on binding");
    }

    if (fs.existsSync(OUT_FAISS)) {
      console.log("FAISS file created:", OUT_FAISS);
    } else {
      console.warn("FAISS file not found after write attempts");
    }
  } catch (err) {
    console.error(
      "Write attempt failed:",
      err && err.message ? err.message : err,
    );
  }

  console.log("\nDiagnostics complete.");
}

main();
