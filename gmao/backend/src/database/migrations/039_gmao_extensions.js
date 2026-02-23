/**
 * Migration 039 - Extensions GMAO : référentiels, budget, sous-traitance, formation,
 * satisfaction, causes racines, modèles OT, pièces jointes, temps par phase, stock (emplacements, réservations), objectifs KPI, templates email
 */

function up(db) {
  // --- Référentiels ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS part_families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // part_families sur spare_parts (optionnel)
  try {
    db.exec('ALTER TABLE spare_parts ADD COLUMN part_family_id INTEGER REFERENCES part_families(id)');
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }
  try {
    db.exec('ALTER TABLE equipment ADD COLUMN brand_id INTEGER REFERENCES brands(id)');
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }

  // --- Budget maintenance ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS maintenance_budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      site_id INTEGER REFERENCES sites(id),
      project_id INTEGER REFERENCES maintenance_projects(id),
      year INTEGER NOT NULL,
      amount REAL DEFAULT 0,
      currency TEXT DEFAULT 'EUR',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_maintenance_budgets_site ON maintenance_budgets(site_id);
    CREATE INDEX IF NOT EXISTS idx_maintenance_budgets_year ON maintenance_budgets(year);
  `);

  // --- Sous-traitance ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS external_contractors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      contact_person TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS subcontract_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT UNIQUE NOT NULL,
      contractor_id INTEGER NOT NULL REFERENCES external_contractors(id),
      work_order_id INTEGER REFERENCES work_orders(id),
      description TEXT,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'sent', 'in_progress', 'completed', 'cancelled', 'invoiced')),
      order_date DATE,
      expected_date DATE,
      completed_date DATE,
      amount REAL DEFAULT 0,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_subcontract_orders_contractor ON subcontract_orders(contractor_id);
    CREATE INDEX IF NOT EXISTS idx_subcontract_orders_wo ON subcontract_orders(work_order_id);
  `);

  // --- Catalogue formations + plan de formation ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS training_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      duration_hours REAL DEFAULT 0,
      validity_months INTEGER,
      is_mandatory INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS training_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      technician_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      training_catalog_id INTEGER NOT NULL REFERENCES training_catalog(id),
      planned_date DATE,
      completed_date DATE,
      status TEXT DEFAULT 'planned' CHECK(status IN ('planned', 'in_progress', 'completed', 'cancelled', 'overdue')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_training_plans_tech ON training_plans(technician_id);
    CREATE INDEX IF NOT EXISTS idx_training_plans_catalog ON training_plans(training_catalog_id);
  `);

  // --- Satisfaction après OT ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS satisfaction_surveys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      rating INTEGER CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      surveyed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_satisfaction_wo ON satisfaction_surveys(work_order_id);
  `);

  // --- Cause racine (équipement / OT) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment_root_causes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      equipment_id INTEGER REFERENCES equipment(id),
      root_cause_code TEXT,
      root_cause_description TEXT,
      analysis_method TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_root_causes_wo ON equipment_root_causes(work_order_id);
  `);

  // --- Modèles d'OT et chaînage ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_order_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      type_id INTEGER REFERENCES work_order_types(id),
      default_priority TEXT DEFAULT 'medium',
      estimated_hours REAL DEFAULT 0,
      checklist_template TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS work_order_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      linked_work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      link_type TEXT DEFAULT 'follows' CHECK(link_type IN ('follows', 'blocks', 'related')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(work_order_id, linked_work_order_id)
    );
    CREATE INDEX IF NOT EXISTS idx_wo_links_wo ON work_order_links(work_order_id);
    CREATE INDEX IF NOT EXISTS idx_wo_links_linked ON work_order_links(linked_work_order_id);
  `);

  // --- Pièces jointes OT (photos / documents) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_order_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      mime_type TEXT,
      attachment_type TEXT DEFAULT 'document' CHECK(attachment_type IN ('document', 'photo_before', 'photo_after', 'other')),
      uploaded_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_wo_attachments_wo ON work_order_attachments(work_order_id);
  `);

  // --- Temps par phase (diagnostic, réparation, essai) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_order_phase_times (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      phase_name TEXT NOT NULL,
      hours_spent REAL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(work_order_id, phase_name)
    );
    CREATE INDEX IF NOT EXISTS idx_wo_phase_times_wo ON work_order_phase_times(work_order_id);
  `);

  // --- Stock : emplacements et réservations ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      site_id INTEGER REFERENCES sites(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS spare_part_locations (
      spare_part_id INTEGER NOT NULL REFERENCES spare_parts(id) ON DELETE CASCADE,
      location_id INTEGER NOT NULL REFERENCES stock_locations(id) ON DELETE CASCADE,
      quantity_reserved INTEGER DEFAULT 0,
      PRIMARY KEY (spare_part_id, location_id)
    );
    CREATE TABLE IF NOT EXISTS stock_reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spare_part_id INTEGER NOT NULL REFERENCES spare_parts(id),
      work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL,
      status TEXT DEFAULT 'reserved' CHECK(status IN ('reserved', 'consumed', 'released', 'cancelled')),
      reserved_by INTEGER REFERENCES users(id),
      reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      released_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_stock_reservations_wo ON stock_reservations(work_order_id);
    CREATE INDEX IF NOT EXISTS idx_stock_reservations_part ON stock_reservations(spare_part_id);
  `);

  try {
    db.exec('ALTER TABLE spare_parts ADD COLUMN location_id INTEGER REFERENCES stock_locations(id)');
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }

  // --- Lots / numéros de série (optionnel) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_lot_serial (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spare_part_id INTEGER NOT NULL REFERENCES spare_parts(id),
      lot_number TEXT,
      serial_number TEXT,
      quantity INTEGER DEFAULT 1,
      expiry_date DATE,
      location_id INTEGER REFERENCES stock_locations(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_stock_lot_serial_part ON stock_lot_serial(spare_part_id);
  `);

  // --- Objectifs KPI ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS kpi_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kpi_definition_id INTEGER REFERENCES kpi_definitions(id) ON DELETE CASCADE,
      site_id INTEGER REFERENCES sites(id),
      year INTEGER NOT NULL,
      target_value REAL,
      unit TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_kpi_targets_def ON kpi_targets(kpi_definition_id);
    CREATE INDEX IF NOT EXISTS idx_kpi_targets_site_year ON kpi_targets(site_id, year);
  `);

  // --- Templates email (paramétrage) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      subject_template TEXT,
      body_template TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

module.exports = { up };
