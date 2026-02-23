/**
 * Migration 043 - Frais supplémentaires par OT
 * Table work_order_extra_fees : frais rattachés à un OT, ajoutés au coût total.
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_order_extra_fees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      description TEXT NOT NULL DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_work_order_extra_fees_wo ON work_order_extra_fees(work_order_id);
  `);
}

module.exports = { up };
