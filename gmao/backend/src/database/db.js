/**
 * Connexion SQLite - sql.js
 * gmao.db = base centrale admin MAINTX : roles, users, tenants (liste des clients + abonnements).
 * Pas de données GMAO opérationnelles (sites, équipements, OT) dans gmao.db.
 * Chaque tenant a sa base client (db_filename) avec schéma GMAO complet.
 * Connexion sans tenant (admin) → base client par défaut (default.db) pour la démo.
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

  function saveDbImmediate() {
    try {
      const data = sqliteDb.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(filePath, buffer);
    } catch (e) {
      console.error('[DB] Erreur sauvegarde:', e.message);
    }
  }

  // Debounce : une seule sauvegarde disque après une rafale d'écritures (évite N sauvegardes par requête)
  let saveTimer = null;
  const SAVE_DEBOUNCE_MS = 300;
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveDbImmediate();
    }, SAVE_DEBOUNCE_MS);
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
        if (!isSelect) scheduleSave();
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
      scheduleSave();
    },
    pragma: (sql) => sqliteDb.exec(`PRAGMA ${sql}`),
    close: () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      saveDbImmediate();
      sqliteDb.close();
    },
    _raw: () => sqliteDb,
    _save: saveDbImmediate,
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

/** Fichiers de migration à ne pas exécuter sur la base client (réservés à gmao.db admin) */
const CLIENT_SKIP_MIGRATIONS = ['026_tenants.js', '027_users_tenant_id.js', '028_tenants_license_dates.js'];

/**
 * Migrations à appliquer sur les bases client : schéma GMAO complet (001-056 sauf tenants).
 * Garantit que default.db a toutes les tables pour tester l'application.
 */
function runClientMigrations(wrapper) {
  if (!wrapper) return;
  try {
    const path = require('path');
    const fs = require('fs');
    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) return;
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.js'))
      .sort();
    for (const f of files) {
      if (CLIENT_SKIP_MIGRATIONS.includes(f)) continue;
      try {
        const m = require(path.join(migrationsDir, f));
        const run = m.up || m.migrate;
        if (run && typeof run === 'function') {
          run(wrapper);
          if (wrapper._save) wrapper._save();
        }
      } catch (e) {
        if (!e.message || (!e.message.includes('already exists') && !e.message.includes('duplicate') && !e.message.includes('duplicate column'))) {
          console.warn('[DB] Migration client:', f, e.message);
        }
      }
    }
  } catch (err) {
    console.warn('[DB] runClientMigrations:', err.message);
  }
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
  // Cache hit : retourner la base sans rejouer les migrations ni sauvegarder (évite lenteur à chaque requête)
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
    runClientMigrations(wrapper);
    wrapper._save();
    _clientDbCache.set(dbFilename, { raw, wrapper });
    return wrapper;
  }
  raw.exec('PRAGMA foreign_keys = ON');
  const wrapper = createDbWrapper(raw, clientPath);
  runClientMigrations(wrapper);
  wrapper._save();
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

/** Base client par défaut pour connexion sans tenant (admin ou démo). */
const DEFAULT_CLIENT_DB = process.env.GMAO_DEFAULT_CLIENT_DB || 'default.db';

/**
 * Retourne la db à utiliser :
 * - gmao.db = base centrale admin MAINTX (tenants, abonnements, utilisateurs) — pas de données GMAO opérationnelles.
 * - Sans tenant (admin) → base client par défaut (default.db) pour utiliser l’app en démo.
 * - Avec tenant_id → base client du tenant (db_filename).
 */
function getDbForRequest(tenantIdFromJwt) {
  if (tenantIdFromJwt == null || tenantIdFromJwt === undefined) {
    // En démo : utiliser gmao.db (même base que le seed) pour que coût période et OT soient visibles
    if (!process.env.GMAO_DEFAULT_CLIENT_DB) return getAdminDb();
    return getClientDb(DEFAULT_CLIENT_DB);
  }
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

/** Appelle les migrations client sur une base (ex. après "no such table" pour work_order_extra_fees). */
function ensureClientMigrations(wrapper) {
  if (wrapper) {
    runClientMigrations(wrapper);
    if (typeof wrapper._save === 'function') wrapper._save();
  }
}

module.exports = db;
module.exports.init = init;
module.exports.getAdminDb = getAdminDb;
module.exports.getClientDb = getClientDb;
module.exports.getDbForRequest = getDbForRequest;
module.exports.resolveTenantByEmail = resolveTenantByEmail;
module.exports.ensureClientMigrations = ensureClientMigrations;
