require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { embeddingService } = require("../services/embeddingService");

async function main() {
  const INDEX_PATH = path.join(__dirname, "..", "..", "data", "index.json");
  const OUT_FAISS = path.join(__dirname, "..", "..", "data", "index.faiss");

  if (!fs.existsSync(INDEX_PATH)) {
    console.error("index.json not found");
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  const docs = raw.docs || [];
  if (docs.length === 0) {
    console.error("no docs");
    process.exit(1);
  }

  // Build embeddings via embeddingService (Cohere)
  const texts = docs.map((d) => d.content);
  console.log("Requesting embeddings for", texts.length, "documents...");
  const vectors = await embeddingService.embedBatch(texts);
  if (!vectors || vectors.length !== texts.length) {
    console.error("embedding generation failed or returned wrong count");
    process.exit(1);
  }

  const dims = vectors[0].length;
  console.log("Embedding dims:", dims);

  // Build FAISS index using nested arrays add
  let faiss = null;
  try {
    faiss = require("faiss-node");
  } catch (err) {
    console.error(
      "faiss-node not available:",
      err && err.message ? err.message : err,
    );
    process.exit(1);
  }

  const IndexClass = faiss.IndexFlatIP || faiss.IndexFlatL2 || faiss.Index;
  if (!IndexClass) {
    console.error("No Index class in faiss-node binding");
    process.exit(1);
  }

  try {
    const index = new IndexClass(dims);
    // Try adding as nested array
    console.log("Adding vectors as nested arrays...");
    index.add(vectors);
    console.log("Added vectors, attempting to write index...");
    if (typeof index.write === "function") {
      index.write(OUT_FAISS);
      console.log("Wrote index via index.write ->", OUT_FAISS);
    } else if (typeof faiss.write_index === "function") {
      faiss.write_index(index, OUT_FAISS);
      console.log("Wrote index via faiss.write_index ->", OUT_FAISS);
    } else if (typeof faiss.write === "function") {
      faiss.write(index, OUT_FAISS);
      console.log("Wrote index via faiss.write ->", OUT_FAISS);
    } else if (faiss.Index && typeof faiss.Index.write === "function") {
      faiss.Index.write(index, OUT_FAISS);
      console.log("Wrote index via faiss.Index.write ->", OUT_FAISS);
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
      "Error building FAISS index:",
      err && err.stack ? err.stack : err,
    );
    process.exit(1);
  }
}

main();
