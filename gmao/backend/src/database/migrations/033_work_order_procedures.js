/**
 * Migration 033 - Lier une ou plusieurs procédures à un OT
 * work_order_procedures : procédures / modes opératoires affectés à l'OT
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_order_procedures (
      work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      procedure_id INTEGER NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
      PRIMARY KEY (work_order_id, procedure_id)
    );
    CREATE INDEX IF NOT EXISTS idx_work_order_procedures_wo ON work_order_procedures(work_order_id);
  `);
}

module.exports = { up };
