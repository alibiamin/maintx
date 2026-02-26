/**
 * Migration 073 - Flux alerte → demande d'appro → demande d'achat → commande
 * - reorder_requests: ajout purchase_request_id, statuts ignored + approved
 */

function up(db) {
  try {
    db.prepare('SELECT 1 FROM reorder_requests LIMIT 1').get();
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return;
    throw e;
  }
  try {
    db.prepare('SELECT purchase_request_id FROM reorder_requests LIMIT 1').get();
  } catch (e) {
    if (!e.message || !e.message.includes('no such column')) throw e;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS reorder_requests_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT,
      spare_part_id INTEGER NOT NULL REFERENCES spare_parts(id),
      quantity_requested INTEGER NOT NULL,
      quantity_ordered INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'ignored', 'ordered', 'partial', 'received', 'cancelled')),
      requested_by INTEGER REFERENCES users(id),
      supplier_order_id INTEGER REFERENCES supplier_orders(id),
      purchase_request_id INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO reorder_requests_new (id, reference, spare_part_id, quantity_requested, quantity_ordered, status, requested_by, supplier_order_id, notes, created_at, updated_at)
    SELECT id, reference, spare_part_id, quantity_requested, quantity_ordered, status, requested_by, supplier_order_id, notes, created_at, updated_at FROM reorder_requests;
    DROP TABLE reorder_requests;
    ALTER TABLE reorder_requests_new RENAME TO reorder_requests;
    CREATE INDEX IF NOT EXISTS idx_reorder_requests_status ON reorder_requests(status);
    CREATE INDEX IF NOT EXISTS idx_reorder_requests_part ON reorder_requests(spare_part_id);
    CREATE INDEX IF NOT EXISTS idx_reorder_requests_purchase_request ON reorder_requests(purchase_request_id);
  `);
}

function down(db) {}

module.exports = { up, down };
