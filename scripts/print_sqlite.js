const path = require("path");
const fs = require("fs");

let Database = null;
try {
  Database = require("better-sqlite3");
} catch (e) {
  console.error(
    "better-sqlite3 is not installed. Run `npm install better-sqlite3` and try again.",
  );
  process.exit(1);
}

const dbPath =
  process.env.SQLITE_DB_PATH ||
  path.join(__dirname, "..", "data", "metadata.sqlite");

if (!fs.existsSync(dbPath)) {
  console.error("Database not found at", dbPath);
  process.exit(1);
}

try {
  const db = new Database(dbPath, { readonly: true });
  const rows = db
    .prepare(
      "SELECT id, source, substr(content,1,400) AS snippet, meta FROM docs ORDER BY id DESC LIMIT 200",
    )
    .all();
  console.log(JSON.stringify(rows, null, 2));
  db.close();
} catch (err) {
  console.error(
    "Failed to read database:",
    err && err.message ? err.message : err,
  );
  process.exit(1);
}
