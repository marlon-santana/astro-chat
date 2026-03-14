require("dotenv").config();
const path = require("path");
const { sqliteRepository } = require("../repositories/sqliteRepository");

(async () => {
  try {
    const INDEX_PATH = path.join(__dirname, "..", "..", "data", "index.json");
    console.log("Populating SQLite metadata from", INDEX_PATH);
    const res = sqliteRepository.upsertFromIndex(INDEX_PATH);
    console.log("Upsert result:", res);
    process.exit(0);
  } catch (err) {
    console.error(
      "SQLite upsert failed:",
      err && err.message ? err.message : err,
    );
    process.exit(2);
  }
})();
