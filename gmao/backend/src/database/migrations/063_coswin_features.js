/**
 * Migration 063 - Fonctionnalités type Coswin 8i
 * - Demandes d'achat (purchase_requests) et lignes
 * - Demandes de prix / RFQ (price_requests) et lignes
 * - Factures fournisseur (supplier_invoices)
 * - Contrôles réglementaires / conformité (regulatory_checks)
 * - Certificats d'étalonnage (tool_calibration_certificates)
 * - Magasins / entrepôts (warehouses), lien stock_locations
 * - Règles de réapprovisionnement (reorder_rules)
 */

function up(db) {
  // --- Demandes d'achat ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pr_number TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      requested_by INTEGER REFERENCES users(id),
      request_date DATE NOT NULL DEFAULT (date('now')),
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'approved', 'rejected', 'ordered', 'cancelled')),
      approved_by INTEGER REFERENCES users(id),
      approved_at DATETIME,
      rejection_reason TEXT,
      supplier_order_id INTEGER REFERENCES supplier_orders(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS purchase_request_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_request_id INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
      spare_part_id INTEGER REFERENCES spare_parts(id),
      description TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price_estimate REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(status);
    CREATE INDEX IF NOT EXISTS idx_purchase_requests_date ON purchase_requests(request_date);
    CREATE INDEX IF NOT EXISTS idx_purchase_request_lines_pr ON purchase_request_lines(purchase_request_id);
  `);

  // --- Demandes de prix (RFQ) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS price_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfq_number TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      supplier_id INTEGER REFERENCES suppliers(id),
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'sent', 'received', 'closed', 'cancelled')),
      sent_date DATE,
      response_due_date DATE,
      response_date DATE,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS price_request_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      price_request_id INTEGER NOT NULL REFERENCES price_requests(id) ON DELETE CASCADE,
      spare_part_id INTEGER REFERENCES spare_parts(id),
      description TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price_quoted REAL,
      supplier_quote_ref TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_price_requests_status ON price_requests(status);
    CREATE INDEX IF NOT EXISTS idx_price_request_lines_rfq ON price_request_lines(price_request_id);
  `);

  // --- Factures fournisseur ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS supplier_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      supplier_order_id INTEGER REFERENCES supplier_orders(id),
      invoice_date DATE NOT NULL,
      due_date DATE,
      total_amount REAL NOT NULL DEFAULT 0,
      currency TEXT DEFAULT 'EUR',
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'received', 'paid', 'cancelled')),
      file_path TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier ON supplier_invoices(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_supplier_invoices_order ON supplier_invoices(supplier_order_id);
    CREATE INDEX IF NOT EXISTS idx_supplier_invoices_date ON supplier_invoices(invoice_date);
  `);

  // --- Contrôles réglementaires / conformité ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS regulatory_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('equipment', 'site')),
      entity_id INTEGER NOT NULL,
      check_type TEXT DEFAULT 'periodic' CHECK(check_type IN ('periodic', 'legal', 'safety', 'quality')),
      frequency_days INTEGER,
      last_done_date DATE,
      next_due_date DATE NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('ok', 'overdue', 'pending', 'cancelled')),
      document_id INTEGER REFERENCES documents(id),
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_regulatory_checks_entity ON regulatory_checks(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_regulatory_checks_due ON regulatory_checks(next_due_date);
    CREATE INDEX IF NOT EXISTS idx_regulatory_checks_status ON regulatory_checks(status);
  `);

  // --- Certificats d'étalonnage (métrologie) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS tool_calibration_certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tool_id INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
      certificate_number TEXT NOT NULL,
      issued_date DATE NOT NULL,
      expiry_date DATE NOT NULL,
      issued_by TEXT,
      file_path TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_tool_certificates_tool ON tool_calibration_certificates(tool_id);
    CREATE INDEX IF NOT EXISTS idx_tool_certificates_expiry ON tool_calibration_certificates(expiry_date);
  `);

  // --- Magasins / entrepôts ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      site_id INTEGER REFERENCES sites(id),
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_warehouses_site ON warehouses(site_id);
  `);
  try {
    db.exec('ALTER TABLE stock_locations ADD COLUMN warehouse_id INTEGER REFERENCES warehouses(id)');
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }

  // --- Règles de réapprovisionnement ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS reorder_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spare_part_id INTEGER NOT NULL REFERENCES spare_parts(id) ON DELETE CASCADE,
      warehouse_id INTEGER REFERENCES warehouses(id),
      site_id INTEGER REFERENCES sites(id),
      min_quantity REAL NOT NULL DEFAULT 0,
      max_quantity REAL NOT NULL DEFAULT 0,
      lead_time_days INTEGER DEFAULT 0,
      auto_create_po INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_reorder_rules_part ON reorder_rules(spare_part_id);
    CREATE INDEX IF NOT EXISTS idx_reorder_rules_warehouse ON reorder_rules(warehouse_id);
  `);

  // Statut 'invoiced' pour les commandes fournisseur (compatibilité)
  try {
    db.exec(`ALTER TABLE supplier_orders ADD COLUMN invoiced_at DATETIME`);
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }

  console.log('✅ Migration 063 : Fonctionnalités Coswin (achats, factures, conformité, métrologie, magasins, réappro) appliquée');
}

function down(db) {
  db.exec(`
    DROP INDEX IF EXISTS idx_reorder_rules_warehouse;
    DROP INDEX IF EXISTS idx_reorder_rules_part;
    DROP TABLE IF EXISTS reorder_rules;
    DROP TABLE IF EXISTS warehouses;
    DROP INDEX IF EXISTS idx_tool_certificates_expiry;
    DROP INDEX IF EXISTS idx_tool_certificates_tool;
    DROP TABLE IF EXISTS tool_calibration_certificates;
    DROP INDEX IF EXISTS idx_regulatory_checks_status;
    DROP INDEX IF EXISTS idx_regulatory_checks_due;
    DROP INDEX IF EXISTS idx_regulatory_checks_entity;
    DROP TABLE IF EXISTS regulatory_checks;
    DROP INDEX IF EXISTS idx_supplier_invoices_date;
    DROP INDEX IF EXISTS idx_supplier_invoices_order;
    DROP INDEX IF EXISTS idx_supplier_invoices_supplier;
    DROP TABLE IF EXISTS supplier_invoices;
    DROP INDEX IF EXISTS idx_price_request_lines_rfq;
    DROP INDEX IF EXISTS idx_price_requests_status;
    DROP TABLE IF EXISTS price_request_lines;
    DROP TABLE IF EXISTS price_requests;
    DROP INDEX IF EXISTS idx_purchase_request_lines_pr;
    DROP INDEX IF EXISTS idx_purchase_requests_date;
    DROP INDEX IF EXISTS idx_purchase_requests_status;
    DROP TABLE IF EXISTS purchase_request_lines;
    DROP TABLE IF EXISTS purchase_requests;
  `);
  console.log('✅ Migration 063 : rollback OK');
}

module.exports = { up, down };
