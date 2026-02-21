/**
 * Migration : Fonctionnalités professionnelles GMAO
 * Ajoute les tables pour documents, contrats, alertes, compétences, outils, checklists, garanties, arrêts planifiés, budgets
 */

const schema = `
PRAGMA foreign_keys = ON;

-- Documents et pièces jointes
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('equipment', 'work_order', 'contract', 'supplier')),
  entity_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  document_type TEXT CHECK(document_type IN ('manual', 'certificate', 'photo', 'invoice', 'contract', 'other')),
  description TEXT,
  uploaded_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Contrats de maintenance
CREATE TABLE IF NOT EXISTS maintenance_contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
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

-- Alertes et notifications
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_type TEXT NOT NULL CHECK(alert_type IN ('stock_low', 'maintenance_due', 'sla_breach', 'contract_expiring', 'equipment_failure', 'custom')),
  severity TEXT DEFAULT 'info' CHECK(severity IN ('info', 'warning', 'error', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT CHECK(entity_type IN ('equipment', 'work_order', 'stock', 'contract', 'maintenance_plan')),
  entity_id INTEGER,
  is_read INTEGER DEFAULT 0,
  read_at DATETIME,
  read_by INTEGER REFERENCES users(id),
  target_user_id INTEGER REFERENCES users(id),
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Compétences et spécialisations
CREATE TABLE IF NOT EXISTS skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT CHECK(category IN ('mechanical', 'electrical', 'hydraulic', 'pneumatic', 'it', 'safety', 'other')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_skills (
  user_id INTEGER NOT NULL REFERENCES users(id),
  skill_id INTEGER NOT NULL REFERENCES skills(id),
  level TEXT DEFAULT 'basic' CHECK(level IN ('basic', 'intermediate', 'advanced', 'expert')),
  certified INTEGER DEFAULT 0,
  certification_date DATE,
  expiry_date DATE,
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS equipment_required_skills (
  equipment_id INTEGER NOT NULL REFERENCES equipment(id),
  skill_id INTEGER NOT NULL REFERENCES skills(id),
  required_level TEXT DEFAULT 'basic' CHECK(required_level IN ('basic', 'intermediate', 'advanced', 'expert')),
  PRIMARY KEY (equipment_id, skill_id)
);

-- Outils et matériels
CREATE TABLE IF NOT EXISTS tools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  tool_type TEXT CHECK(tool_type IN ('hand_tool', 'power_tool', 'measuring', 'safety', 'other')),
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  location TEXT,
  status TEXT DEFAULT 'available' CHECK(status IN ('available', 'in_use', 'maintenance', 'retired')),
  calibration_date DATE,
  calibration_due_date DATE,
  purchase_date DATE,
  purchase_price REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tool_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_id INTEGER NOT NULL REFERENCES tools(id),
  work_order_id INTEGER REFERENCES work_orders(id),
  assigned_to INTEGER REFERENCES users(id),
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  returned_at DATETIME,
  notes TEXT
);

-- Checklists de maintenance
CREATE TABLE IF NOT EXISTS maintenance_checklists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  maintenance_plan_id INTEGER REFERENCES maintenance_plans(id),
  name TEXT NOT NULL,
  description TEXT,
  is_template INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checklist_id INTEGER NOT NULL REFERENCES maintenance_checklists(id),
  item_text TEXT NOT NULL,
  item_type TEXT DEFAULT 'check' CHECK(item_type IN ('check', 'measurement', 'text', 'photo')),
  required INTEGER DEFAULT 1,
  expected_value TEXT,
  unit TEXT,
  order_index INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS checklist_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checklist_id INTEGER NOT NULL REFERENCES maintenance_checklists(id),
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
  executed_by INTEGER REFERENCES users(id),
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS checklist_item_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id INTEGER NOT NULL REFERENCES checklist_executions(id),
  item_id INTEGER NOT NULL REFERENCES checklist_items(id),
  value TEXT,
  is_ok INTEGER,
  photo_path TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Garanties
CREATE TABLE IF NOT EXISTS warranties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  warranty_number TEXT UNIQUE NOT NULL,
  equipment_id INTEGER REFERENCES equipment(id),
  supplier_id INTEGER REFERENCES suppliers(id),
  warranty_type TEXT DEFAULT 'parts' CHECK(warranty_type IN ('parts', 'labor', 'full', 'extended')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  coverage_description TEXT,
  terms TEXT,
  contact_info TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Arrêts de production planifiés
CREATE TABLE IF NOT EXISTS planned_shutdowns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shutdown_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  equipment_id INTEGER REFERENCES equipment(id),
  site_id INTEGER REFERENCES sites(id),
  start_date DATETIME NOT NULL,
  end_date DATETIME NOT NULL,
  duration_hours REAL,
  reason TEXT,
  impact_level TEXT DEFAULT 'medium' CHECK(impact_level IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'planned' CHECK(status IN ('planned', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  created_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shutdown_work_orders (
  shutdown_id INTEGER NOT NULL REFERENCES planned_shutdowns(id),
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
  PRIMARY KEY (shutdown_id, work_order_id)
);

-- Budgets et coûts par projet
CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  budget_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT CHECK(project_type IN ('maintenance', 'improvement', 'replacement', 'upgrade', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  allocated_budget REAL NOT NULL DEFAULT 0,
  spent_amount REAL DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'approved', 'active', 'closed', 'cancelled')),
  created_by INTEGER REFERENCES users(id),
  approved_by INTEGER REFERENCES users(id),
  approved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budget_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  budget_id INTEGER NOT NULL REFERENCES budgets(id),
  item_type TEXT CHECK(item_type IN ('work_order', 'purchase', 'contract', 'other')),
  reference_id INTEGER,
  description TEXT NOT NULL,
  planned_amount REAL NOT NULL DEFAULT 0,
  actual_amount REAL DEFAULT 0,
  category TEXT CHECK(category IN ('labor', 'parts', 'external', 'other')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_contracts_supplier ON maintenance_contracts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_contracts_equipment ON maintenance_contracts(equipment_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type, is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(target_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_tools_status ON tools(status);
CREATE INDEX IF NOT EXISTS idx_tool_assignments ON tool_assignments(tool_id, returned_at);
CREATE INDEX IF NOT EXISTS idx_checklist_executions ON checklist_executions(work_order_id);
CREATE INDEX IF NOT EXISTS idx_warranties_equipment ON warranties(equipment_id);
CREATE INDEX IF NOT EXISTS idx_shutdowns_dates ON planned_shutdowns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_budgets_status ON budgets(status);
CREATE INDEX IF NOT EXISTS idx_budget_items ON budget_items(budget_id);
`;

module.exports = {
  up: (db) => {
    try {
      db.exec(schema);
      console.log('✅ Migration 003 : Fonctionnalités professionnelles appliquée');
    } catch (err) {
      // Ignorer les erreurs de table déjà existante ou index déjà existant
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        console.log('ℹ️  Migration 003 : Tables déjà existantes, ignoré');
      } else {
        throw err;
      }
    }
  },
  down: (db) => {
    // Rollback - supprimer les tables dans l'ordre inverse
    const rollback = `
      DROP INDEX IF EXISTS idx_budget_items;
      DROP INDEX IF EXISTS idx_budgets_status;
      DROP INDEX IF EXISTS idx_shutdowns_dates;
      DROP INDEX IF EXISTS idx_warranties_equipment;
      DROP INDEX IF EXISTS idx_checklist_executions;
      DROP INDEX IF EXISTS idx_tool_assignments;
      DROP INDEX IF EXISTS idx_tools_status;
      DROP INDEX IF EXISTS idx_alerts_user;
      DROP INDEX IF EXISTS idx_alerts_type;
      DROP INDEX IF EXISTS idx_contracts_equipment;
      DROP INDEX IF EXISTS idx_contracts_supplier;
      DROP INDEX IF EXISTS idx_documents_entity;
      
      DROP TABLE IF EXISTS budget_items;
      DROP TABLE IF EXISTS budgets;
      DROP TABLE IF EXISTS shutdown_work_orders;
      DROP TABLE IF EXISTS planned_shutdowns;
      DROP TABLE IF EXISTS warranties;
      DROP TABLE IF EXISTS checklist_item_results;
      DROP TABLE IF EXISTS checklist_executions;
      DROP TABLE IF EXISTS checklist_items;
      DROP TABLE IF EXISTS maintenance_checklists;
      DROP TABLE IF EXISTS tool_assignments;
      DROP TABLE IF EXISTS tools;
      DROP TABLE IF EXISTS equipment_required_skills;
      DROP TABLE IF EXISTS user_skills;
      DROP TABLE IF EXISTS skills;
      DROP TABLE IF EXISTS alerts;
      DROP TABLE IF EXISTS maintenance_contracts;
      DROP TABLE IF EXISTS documents;
    `;
    db.exec(rollback);
    console.log('✅ Rollback migration 003 effectué');
  }
};
