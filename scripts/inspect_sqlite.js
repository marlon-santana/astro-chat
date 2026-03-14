const path = require("path");
const fs = require("fs");
let Database = null;
try {
  Database = require("better-sqlite3");
} catch (e) {
  console.error("better-sqlite3 not installed");
  process.exit(1);
}
const dbPath =
  process.env.SQLITE_DB_PATH ||
  path.join(__dirname, "..", "data", "metadata.sqlite");
if (!fs.existsSync(dbPath)) {
  console.error("DB not found", dbPath);
  process.exit(1);
}
const db = new Database(dbPath, { readonly: true });
const rows = db
  .prepare(
    "SELECT id, source, content, meta FROM docs ORDER BY id DESC LIMIT 10",
  )
  .all();
const out = rows.map((r) => {
  let meta = {};
  try {
    meta = JSON.parse(r.meta || "{}");
  } catch (e) {}
  return {
    id: r.id,
    source: r.source,
    snippet: (r.content || "").slice(0, 200).replace(/\n/g, " "),
    hasEmbedding: Array.isArray(meta.embedding),
    embeddingLen: Array.isArray(meta.embedding) ? meta.embedding.length : 0,
  };
});
console.log(JSON.stringify(out, null, 2));
db.close();
