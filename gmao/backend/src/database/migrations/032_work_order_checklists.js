/**
 * Migration 032 - Lier des checklists à un OT dès la création (à exécuter)
 * work_order_checklists : checklists affectées à l'OT (en plus de celles du plan)
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_order_checklists (
      work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      checklist_id INTEGER NOT NULL REFERENCES maintenance_checklists(id) ON DELETE CASCADE,
      PRIMARY KEY (work_order_id, checklist_id)
    );
    CREATE INDEX IF NOT EXISTS idx_work_order_checklists_wo ON work_order_checklists(work_order_id);
  `);
}

module.exports = { up };
