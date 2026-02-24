/**
 * Migration 007 - checklist_executions : work_order_id optionnel (exécution sans OT lié)
 * Désactive temporairement les FK pour éviter l'échec si des lignes ont des références orphelines.
 */
function up(db) {
  db.pragma('foreign_keys = OFF');
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS checklist_executions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        checklist_id INTEGER NOT NULL REFERENCES maintenance_checklists(id),
        work_order_id INTEGER REFERENCES work_orders(id),
        executed_by INTEGER REFERENCES users(id),
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      );
      INSERT INTO checklist_executions_new (id, checklist_id, work_order_id, executed_by, executed_at, notes)
      SELECT id, checklist_id, work_order_id, executed_by, executed_at, notes FROM checklist_executions;
      DROP TABLE checklist_executions;
      ALTER TABLE checklist_executions_new RENAME TO checklist_executions;
      CREATE INDEX IF NOT EXISTS idx_checklist_executions_checklist ON checklist_executions(checklist_id);
      CREATE INDEX IF NOT EXISTS idx_checklist_executions_wo ON checklist_executions(work_order_id);
    `);
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

module.exports = { up };
