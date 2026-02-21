/**
 * Migration 005 - Inventaires physiques et demandes de réapprovisionnement
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_inventories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT UNIQUE NOT NULL,
      inventory_date DATE NOT NULL,
      responsible_id INTEGER REFERENCES users(id),
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'in_progress', 'completed', 'cancelled')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_stock_inventories_date ON stock_inventories(inventory_date);
    CREATE INDEX IF NOT EXISTS idx_stock_inventories_status ON stock_inventories(status);

    CREATE TABLE IF NOT EXISTS stock_inventory_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventory_id INTEGER NOT NULL REFERENCES stock_inventories(id) ON DELETE CASCADE,
      spare_part_id INTEGER NOT NULL REFERENCES spare_parts(id),
      quantity_system INTEGER NOT NULL DEFAULT 0,
      quantity_counted INTEGER,
      variance INTEGER,
      notes TEXT,
      UNIQUE(inventory_id, spare_part_id)
    );
    CREATE INDEX IF NOT EXISTS idx_inventory_lines_inventory ON stock_inventory_lines(inventory_id);

    CREATE TABLE IF NOT EXISTS reorder_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT,
      spare_part_id INTEGER NOT NULL REFERENCES spare_parts(id),
      quantity_requested INTEGER NOT NULL,
      quantity_ordered INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'ordered', 'partial', 'received', 'cancelled')),
      requested_by INTEGER REFERENCES users(id),
      supplier_order_id INTEGER REFERENCES supplier_orders(id),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_reorder_requests_status ON reorder_requests(status);
    CREATE INDEX IF NOT EXISTS idx_reorder_requests_part ON reorder_requests(spare_part_id);
  `);
}

module.exports = { up };
