/**
 * Migration 002 - Fonctionnalités GMAO professionnel (Coswin-inspired)
 * - Codes défaut / causes de panne
 * - Plans réglementaires
 * - Taux horaire pour coûts main d'œuvre
 */

async function migrate(db) {
  // Table des codes défaut / causes de panne
  db.exec(`
    CREATE TABLE IF NOT EXISTS failure_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Colonne failure_code_id sur work_orders
  try {
    db.exec('ALTER TABLE work_orders ADD COLUMN failure_code_id INTEGER REFERENCES failure_codes(id)');
  } catch (e) {
    if (!e.message?.includes('duplicate column')) throw e;
  }

  // Plans réglementaires (is_regulatory)
  try {
    db.exec('ALTER TABLE maintenance_plans ADD COLUMN is_regulatory INTEGER DEFAULT 0');
  } catch (e) {
    if (!e.message?.includes('duplicate column')) throw e;
  }

  // Taux horaire technicien (pour coûts) - on peut stocker dans une table param
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try {
    db.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)').run('hourly_rate', '45');
  } catch (e) {}

  // Données de référence : codes défaut
  const codes = [
    { code: 'MEC-01', name: 'Usure mécanique', category: 'Mécanique' },
    { code: 'ELEC-01', name: 'Panne électrique', category: 'Électrique' },
    { code: 'HYD-01', name: 'Fuite hydraulique', category: 'Hydraulique' },
    { code: 'TEMP-01', name: 'Surchauffe', category: 'Thermique' },
    { code: 'VIB-01', name: 'Vibrations anormales', category: 'Mécanique' },
    { code: 'AUTRE', name: 'Autre / Non identifié', category: 'Général' }
  ];
  for (const c of codes) {
    db.prepare('INSERT OR IGNORE INTO failure_codes (code, name, category) VALUES (?, ?, ?)').run(c.code, c.name, c.category);
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_work_orders_failure_code ON work_orders(failure_code_id)');
}

module.exports = { migrate };
