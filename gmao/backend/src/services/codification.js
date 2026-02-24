/**
 * Génération des codes automatiques (préfixe + numéro sur N chiffres)
 * Multi-tenant : db (req.db) doit être passé en premier argument.
 */
const ENTITY_CONFIG_KEYS = {
  site: 'codification_site',
  departement: 'codification_departement',
  ligne: 'codification_ligne',
  machine: 'codification_machine',
  piece: 'codification_piece',
  outil: 'codification_outil',
  fournisseur: 'codification_fournisseur',
  code_defaut: 'codification_code_defaut',
  demande_intervention: 'codification_demande_intervention'
};

const ENTITY_TABLE = {
  site: { table: 'sites', codeCol: 'code' },
  departement: { table: 'departements', codeCol: 'code', siteCol: 'site_id' },
  ligne: { table: 'lignes', codeCol: 'code', siteCol: 'site_id' },
  machine: { table: 'equipment', codeCol: 'code' },
  piece: { table: 'spare_parts', codeCol: 'code' },
  outil: { table: 'tools', codeCol: 'code' },
  fournisseur: { table: 'suppliers', codeCol: 'code' },
  code_defaut: { table: 'failure_codes', codeCol: 'code' },
  demande_intervention: { table: 'intervention_requests', codeCol: 'number' }
};

const DEFAULT_CONFIG = {
  site: { prefix: 'S', length: 4 },
  departement: { prefix: 'DEP', length: 3 },
  ligne: { prefix: 'L', length: 3 },
  machine: { prefix: 'EQ', length: 5 },
  piece: { prefix: 'P', length: 5 },
  outil: { prefix: 'O', length: 4 },
  fournisseur: { prefix: 'F', length: 4 },
  code_defaut: { prefix: 'CD', length: 3 },
  demande_intervention: { prefix: 'DI', length: 4 }
};

function ensureAppSettingsTable(db) {
  try {
    db.exec('CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  } catch (e) {}
}

function getConfig(db, entity) {
  ensureAppSettingsTable(db);
  const key = ENTITY_CONFIG_KEYS[entity];
  if (!key) return null;
  try {
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
    if (row?.value) {
      const c = JSON.parse(row.value);
      return { prefix: c.prefix || '', length: Math.max(1, parseInt(c.length, 10) || 4) };
    }
  } catch (e) {}
  return DEFAULT_CONFIG[entity] ? { ...DEFAULT_CONFIG[entity] } : null;
}

function getAllConfig(db) {
  ensureAppSettingsTable(db);
  const result = {};
  for (const entity of Object.keys(ENTITY_CONFIG_KEYS)) {
    result[entity] = getConfig(db, entity);
  }
  return result;
}

function setConfig(db, entity, { prefix = '', length = 4 }) {
  ensureAppSettingsTable(db);
  const key = ENTITY_CONFIG_KEYS[entity];
  if (!key) return null;
  const value = JSON.stringify({ prefix: String(prefix), length: Math.max(1, parseInt(length, 10) || 4) });
  db.prepare('INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run(key, value);
  return getConfig(db, entity);
}

function setAllConfig(db, configByEntity) {
  if (configByEntity && typeof configByEntity === 'object') {
    for (const [entity, c] of Object.entries(configByEntity)) {
      if (ENTITY_CONFIG_KEYS[entity] && c && (c.prefix !== undefined || c.length !== undefined)) {
        setConfig(db, entity, { prefix: c.prefix ?? getConfig(db, entity)?.prefix ?? '', length: c.length ?? getConfig(db, entity)?.length ?? 4 });
      }
    }
  }
  return getAllConfig(db);
}

/**
 * Calcule le prochain code pour une entité.
 * @param {object} db - base (req.db)
 * @param {string} entity - site | departement | ligne | machine | piece | outil | fournisseur | code_defaut
 * @param {number} [siteId] - requis pour departement et ligne (séquence par site)
 */
function getNextCode(db, entity, siteId) {
  const config = getConfig(db, entity);
  if (!config || config.prefix === undefined) return null;

  const meta = ENTITY_TABLE[entity];
  if (!meta) return null;

  const { table, codeCol, siteCol } = meta;
  let maxNum = 0;

  try {
    let sql = `SELECT ${codeCol} FROM ${table}`;
    const params = [];
    const conditions = [];
    if (config.prefix !== '') {
      conditions.push(`${codeCol} LIKE ?`);
      params.push(config.prefix + '%');
    }
    if (siteCol && siteId != null) {
      conditions.push(`${siteCol} = ?`);
      params.push(siteId);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ` ORDER BY ${codeCol} DESC`;
    const rows = db.prepare(sql).all(...params);

    const prefixLen = (config.prefix || '').length;
    for (const row of rows) {
      const code = row[codeCol];
      if (!code || (config.prefix && !code.startsWith(config.prefix))) continue;
      const numPart = code.slice(prefixLen).replace(/^0+/, '') || '0';
      const n = parseInt(numPart, 10);
      if (!Number.isNaN(n) && n > maxNum) maxNum = n;
    }
  } catch (e) {
    return null;
  }

  const nextNum = maxNum + 1;
  const padded = String(nextNum).padStart(config.length, '0');
  return (config.prefix || '') + padded;
}

/**
 * Génère et retourne le prochain code si la codification est configurée pour cette entité.
 * À appeler au moment de l'insertion (code non fourni par le client).
 */
function generateCodeIfNeeded(db, entity, providedCode, siteId) {
  if (providedCode && String(providedCode).trim() !== '') return String(providedCode).trim();
  return getNextCode(db, entity, siteId) || null;
}

module.exports = {
  ENTITY_CONFIG_KEYS,
  getConfig,
  getAllConfig,
  setConfig,
  setAllConfig,
  getNextCode,
  generateCodeIfNeeded,
  DEFAULT_CONFIG
};
