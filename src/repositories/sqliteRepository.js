const fs = require("fs");
const path = require("path");

let Database = null;
try {
  Database = require("better-sqlite3");
} catch (e) {
  console.warn(
    "better-sqlite3 not installed; run `npm install better-sqlite3` to enable SQLite metadata store",
  );
}

const DB_PATH =
  process.env.SQLITE_DB_PATH ||
  path.join(__dirname, "..", "..", "data", "metadata.sqlite");

function init() {
  if (!Database) return null;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS docs (
      id INTEGER PRIMARY KEY,
      source TEXT,
      content TEXT,
      meta TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_docs_source ON docs(source);
  `);
  return db;
}

function upsertFromIndex(indexPath) {
  if (!Database) throw new Error("better-sqlite3 not available");
  if (!fs.existsSync(indexPath)) throw new Error("index.json not found");
  const raw = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const docs = raw.docs || raw;
  const db = init();
  const insert = db.prepare(
    "INSERT OR REPLACE INTO docs (id, source, content, meta) VALUES (@id,@source,@content,@meta)",
  );
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insert.run(r);
  });

  const rows = docs.map((d, i) => ({
    id: i,
    source: d.source || (d.meta && d.meta.source) || null,
    content: d.content || "",
    meta: JSON.stringify(d.meta || {}),
  }));

  insertMany(rows);
  db.close();
  return { upserted: rows.length };
}

function getDocsByIds(ids) {
  if (!Database) return null;
  const db = init();
  if (!ids || ids.length === 0) return [];
  const q = db.prepare(
    `SELECT id, source, content, meta FROM docs WHERE id IN (${ids.map(() => "?").join(",")})`,
  );
  const rows = q
    .all(...ids)
    .map((r) => ({
      id: r.id,
      source: r.source,
      content: r.content,
      meta: JSON.parse(r.meta || "{}"),
    }));
  db.close();
  // preserve order requested
  const map = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => map.get(id)).filter(Boolean);
}

module.exports = { sqliteRepository: { upsertFromIndex, getDocsByIds, init } };
