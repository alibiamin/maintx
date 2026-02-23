/**
 * Migration 034 - Plusieurs opérateurs par OT (équipe)
 * work_order_operators : opérateurs / techniciens affectés à l'OT
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_order_operators (
      work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (work_order_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_work_order_operators_wo ON work_order_operators(work_order_id);
  `);
}

module.exports = { up };
