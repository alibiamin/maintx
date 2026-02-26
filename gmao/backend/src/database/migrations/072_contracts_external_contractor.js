/**
 * Migration 072 - Contrats de sous-traitance
 * Ajoute external_contractor_id et rend supplier_id nullable pour que les contrats
 * de maintenance soient liés aux prestataires (sous-traitance) et non aux fournisseurs (achats).
 */

function up(db) {
  try {
    db.prepare('SELECT 1 FROM maintenance_contracts LIMIT 1').get();
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return;
    throw e;
  }
  try {
    db.prepare('SELECT external_contractor_id FROM maintenance_contracts LIMIT 1').get();
    return; // déjà migré
  } catch (e) {
    if (!e.message || !e.message.includes('no such column')) throw e;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS maintenance_contracts_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_number TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      supplier_id INTEGER REFERENCES suppliers(id),
      external_contractor_id INTEGER REFERENCES external_contractors(id),
      equipment_id INTEGER REFERENCES equipment(id),
      contract_type TEXT DEFAULT 'preventive' CHECK(contract_type IN ('preventive', 'corrective', 'full', 'spare_parts')),
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      annual_cost REAL DEFAULT 0,
      frequency_days INTEGER,
      description TEXT,
      terms TEXT,
      is_active INTEGER DEFAULT 1,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO maintenance_contracts_new (id, contract_number, name, supplier_id, equipment_id, contract_type, start_date, end_date, annual_cost, frequency_days, description, terms, is_active, created_by, created_at, updated_at)
    SELECT id, contract_number, name, supplier_id, equipment_id, contract_type, start_date, end_date, annual_cost, frequency_days, description, terms, is_active, created_by, created_at, updated_at FROM maintenance_contracts;
    DROP TABLE maintenance_contracts;
    ALTER TABLE maintenance_contracts_new RENAME TO maintenance_contracts;
    CREATE INDEX IF NOT EXISTS idx_contracts_supplier ON maintenance_contracts(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_contracts_equipment ON maintenance_contracts(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_contracts_external_contractor ON maintenance_contracts(external_contractor_id);
  `);
}

function down(db) {
  // Non réversible sans perte (colonnes / nullabilité).
}

module.exports = { up, down };
