require("dotenv").config();
const path = require("path");
const { qdrantRepository } = require("../repositories/qdrantRepository");

(async () => {
  const INDEX_PATH = path.join(__dirname, "..", "..", "data", "index.json");
  try {
    console.log("QDRANT_URL:", process.env.QDRANT_URL || "not set");
    const res = await qdrantRepository.upsertFromIndex(INDEX_PATH);
    console.log("Upsert result:", res);
    process.exit(0);
  } catch (err) {
    console.error(
      "Qdrant upsert failed:",
      err && err.message ? err.message : err,
    );
    process.exit(2);
  }
})();
