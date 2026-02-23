/**
 * Connexion SQLite - sql.js
 * gmao.db = base MAINTX (admins, paramétrage, liste des clients, comptes utilisateurs).
 * À la première connexion d'un client, sa base .db est créée vierge (schéma GMAO).
 */

const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const GMAO_DB_PATH = path.join(dataDir, process.env.GMAO_DB_PATH || 'gmao.db');

let _SQL = null;
let _adminDb = null;
let _adminWrapper = null;
const _clientDbCache = new Map(); // db_filename -> { raw, wrapper }

/**
 * Crée un wrapper db (prepare, exec, etc.) autour d'une instance sql.js
 */
function createDbWrapper(sqliteDb, filePath) {
  if (!sqliteDb || !filePath) return null;

  function saveDb() {
    try {
      const data = sqliteDb.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(filePath, buffer);
    } catch (e) {
      console.error('[DB] Erreur sauvegarde:', e.message);
    }
  }

  function createPrepareWrapper(sql) {
    const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
    return {
      run: (...params) => {
        const stmt = sqliteDb.prepare(sql);
        stmt.bind(params.length ? params : null);
        stmt.step();
        const result = sqliteDb.exec('SELECT last_insert_rowid() as id, changes() as changes');
        stmt.free();
        const lastInsertRowid = result.length && result[0].values[0] ? result[0].values[0][0] : 0;
        const changes = result.length && result[0].values[0] ? result[0].values[0][1] : 0;
        if (!isSelect) saveDb();
        return { lastInsertRowid, changes };
      },
      get: (...params) => {
        const stmt = sqliteDb.prepare(sql);
        stmt.bind(params.length ? params : null);
        const row = stmt.step() ? stmt.getAsObject() : null;
        stmt.free();
        return row;
      },
      all: (...params) => {
        const stmt = sqliteDb.prepare(sql);
        stmt.bind(params.length ? params : null);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      }
    };
  }

  return {
    prepare: (sql) => createPrepareWrapper(sql),
    exec: (sql) => {
      sqliteDb.exec(sql);
      saveDb();
    },
    pragma: (sql) => sqliteDb.exec(`PRAGMA ${sql}`),
    close: () => {
      saveDb();
      sqliteDb.close();
    },
    _raw: () => sqliteDb,
    _save: saveDb,
    getPath: () => filePath
  };
}

/**
 * Base MAINTX (gmao.db) : admins, tenants, tous les comptes utilisateurs, données de test/gestion
 */
function getAdminDb() {
  if (!_adminWrapper) throw new Error('DB non initialisée. Appelez db.init() au démarrage.');
  return _adminWrapper;
}

/**
 * Base client : par id tenant. Si le fichier n'existe pas, crée une base vierge (schéma GMAO).
 */
function getClientDb(tenantIdOrKey) {
  const mainDb = getAdminDb();
  let dbFilename;
  if (typeof tenantIdOrKey === 'number') {
    const row = mainDb.prepare('SELECT db_filename FROM tenants WHERE id = ?').get(tenantIdOrKey);
    if (!row) throw new Error('Tenant inconnu');
    dbFilename = row.db_filename;
  } else {
    dbFilename = tenantIdOrKey.endsWith('.db') ? tenantIdOrKey : `${tenantIdOrKey}.db`;
  }
  if (_clientDbCache.has(dbFilename)) {
    return _clientDbCache.get(dbFilename).wrapper;
  }
  const clientPath = path.join(dataDir, dbFilename);
  if (!_SQL) throw new Error('DB non initialisée');
  let raw;
  if (fs.existsSync(clientPath)) {
    const buffer = fs.readFileSync(clientPath);
    raw = new _SQL.Database(buffer);
  } else {
    raw = new _SQL.Database();
    raw.exec('PRAGMA foreign_keys = ON');
    try {
      const { schema } = require('./init');
      if (schema) raw.exec(schema);
    } catch (e) {
      console.warn('[DB] Schéma client:', e.message);
    }
    const wrapper = createDbWrapper(raw, clientPath);
    wrapper._save();
    _clientDbCache.set(dbFilename, { raw, wrapper });
    return wrapper;
  }
  raw.exec('PRAGMA foreign_keys = ON');
  const wrapper = createDbWrapper(raw, clientPath);
  _clientDbCache.set(dbFilename, { raw, wrapper });
  return wrapper;
}

/**
 * Détermine admin MAINTX (tenant_id NULL) ou client (tenant_id non NULL). Tous les utilisateurs sont dans gmao.db.
 */
function resolveTenantByEmail(email) {
  const normalized = String(email).trim().toLowerCase();
  const db = getAdminDb();
  try {
    const user = db.prepare('SELECT id, tenant_id FROM users WHERE email = ? AND is_active = 1').get(normalized);
    if (!user) return null;
    if (user.tenant_id == null) return { isAdmin: true };
    return { isAdmin: false, tenantId: user.tenant_id };
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      const user = db.prepare('SELECT id FROM users WHERE email = ? AND is_active = 1').get(normalized);
      return user ? { isAdmin: true } : null;
    }
    throw e;
  }
}

/**
 * Retourne la db à utiliser : gmao.db pour admin, base client pour un tenant.
 */
function getDbForRequest(tenantIdFromJwt) {
  if (tenantIdFromJwt == null || tenantIdFromJwt === undefined) return getAdminDb();
  return getClientDb(tenantIdFromJwt);
}

async function init() {
  if (_adminWrapper) return { getAdminDb, getClientDb, getDbForRequest, resolveTenantByEmail };
  const initSqlJs = require('sql.js');
  _SQL = await initSqlJs();
  if (fs.existsSync(GMAO_DB_PATH)) {
    const buffer = fs.readFileSync(GMAO_DB_PATH);
    _adminDb = new _SQL.Database(buffer);
  } else {
    _adminDb = new _SQL.Database();
  }
  _adminDb.exec('PRAGMA foreign_keys = ON');
  _adminWrapper = createDbWrapper(_adminDb, GMAO_DB_PATH);
  console.log('[DB] Base MAINTX :', GMAO_DB_PATH);
  return { getAdminDb, getClientDb, getDbForRequest, resolveTenantByEmail };
}

function close() {
  if (_adminWrapper) {
    _adminWrapper._save();
    _adminDb.close();
    _adminDb = null;
    _adminWrapper = null;
  }
  for (const [, { wrapper }] of _clientDbCache) {
    try { wrapper.close(); } catch (_) {}
  }
  _clientDbCache.clear();
}

// Rétrocompatibilité : export d'un objet qui délègue vers la db "courante" si définie (via middleware)
// Les routes utilisent req.db ; ce module exporte les helpers.
const db = {
  get prepare() { return (sql) => { throw new Error('Utilisez req.db dans les routes (multi-tenant)'); }; },
  get exec() { return () => { throw new Error('Utilisez req.db dans les routes (multi-tenant)'); }; },
  get pragma() { return () => { throw new Error('Utilisez req.db dans les routes (multi-tenant)'); }; },
  close,
  _save: () => {},
  getPath: () => GMAO_DB_PATH,
  init,
  getAdminDb,
  getClientDb,
  getDbForRequest,
  resolveTenantByEmail
};

module.exports = db;
module.exports.init = init;
module.exports.getAdminDb = getAdminDb;
module.exports.getClientDb = getClientDb;
module.exports.getDbForRequest = getDbForRequest;
module.exports.resolveTenantByEmail = resolveTenantByEmail;
