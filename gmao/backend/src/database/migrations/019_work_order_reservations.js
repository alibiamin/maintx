/**
 * Migration 019 - Réservation de pièces pour un OT (préparation chantier)
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_order_reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      spare_part_id INTEGER NOT NULL REFERENCES spare_parts(id),
      quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(work_order_id, spare_part_id)
    );
    CREATE INDEX IF NOT EXISTS idx_wo_reservations_wo ON work_order_reservations(work_order_id);
    CREATE INDEX IF NOT EXISTS idx_wo_reservations_part ON work_order_reservations(spare_part_id);
  `);
}

module.exports = { up };
