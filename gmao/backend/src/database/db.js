/**
 * Connexion SQLite - sql.js (pure JS, pas de compilation native)
 */

const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'xmaint.db');

let _db = null;
let _SQL = null;

function createPrepareWrapper(sql) {
  const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
  return {
    run: (...params) => {
      const stmt = _db.prepare(sql);
      stmt.bind(params.length ? params : null);
      stmt.step();
      const result = _db.exec('SELECT last_insert_rowid() as id, changes() as changes');
      stmt.free();
      const lastInsertRowid = result.length && result[0].values[0] ? result[0].values[0][0] : 0;
      const changes = result.length && result[0].values[0] ? result[0].values[0][1] : 0;
      if (!isSelect) saveDb();
      return { lastInsertRowid, changes };
    },
    get: (...params) => {
      const stmt = _db.prepare(sql);
      stmt.bind(params.length ? params : null);
      const row = stmt.step() ? stmt.getAsObject() : null;
      stmt.free();
      return row;
    },
    all: (...params) => {
      const stmt = _db.prepare(sql);
      stmt.bind(params.length ? params : null);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    }
  };
}

function saveDb() {
  if (_db && dbPath) {
    try {
      const data = _db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);
    } catch (e) {
      console.error('[DB] Erreur sauvegarde:', e.message);
    }
  }
}

const db = {
  prepare: (sql) => createPrepareWrapper(sql),
  exec: (sql) => {
    _db.exec(sql);
    saveDb();
  },
  pragma: (sql) => _db.exec(`PRAGMA ${sql}`),
  close: () => { if (_db) { saveDb(); _db.close(); _db = null; } },
  _raw: () => _db,
  _save: saveDb,
  getPath: () => dbPath
};

async function init() {
  if (_db) return db;
  const initSqlJs = require('sql.js');
  _SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    _db = new _SQL.Database(buffer);
  } else {
    _db = new _SQL.Database();
  }
  _db.exec('PRAGMA foreign_keys = ON');
  return db;
}

module.exports = db;
module.exports.init = init;
