// Simple SQLite store using JSON column per instance
// Requires: better-sqlite3 (install in your app: npm i better-sqlite3)

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  // Defer error until actually constructing the store
}

function sanitizeTable(name) {
  const safe = String(name).toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!safe) throw new Error('Invalid table name');
  return safe;
}

class SqliteStore {
  constructor(dbPath, options = {}) {
    if (!Database) {
      throw new Error("better-sqlite3 is required to use SqliteStore. Install it with 'npm i better-sqlite3'.");
    }
    if (!dbPath) throw new Error('SqliteStore requires a dbPath');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.tableCache = new Set();
    this.tableForType = options.tableForType || ((type) => `${type.toLowerCase()}s`);
  }

  ensureTable(table) {
    const t = sanitizeTable(table);
    if (this.tableCache.has(t)) return t;
    const sql = `CREATE TABLE IF NOT EXISTS ${t} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`;
    this.db.prepare(sql).run();
    this.tableCache.add(t);
    return t;
  }

  async load(type, id) {
    const table = this.ensureTable(this.tableForType(type));
    const row = this.db.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id);
    if (!row) return null;
    try { return JSON.parse(row.data); } catch { return null; }
  }

  async persist(type, id, _diff, full) {
    const table = this.ensureTable(this.tableForType(type));
    const data = JSON.stringify(full == null ? {} : full);
    // REPLACE is widely supported; ON CONFLICT requires newer SQLite
    this.db.prepare(`REPLACE INTO ${table} (id, data) VALUES (?, ?);`).run(id, data);
  }
}

module.exports = { SqliteStore };

