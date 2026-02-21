/**
 * Migration 008 - maintenance_plans : last_execution_work_order_id pour traçabilité
 */
function up(db) {
  try {
    db.exec(`
      ALTER TABLE maintenance_plans ADD COLUMN last_execution_work_order_id INTEGER REFERENCES work_orders(id);
      CREATE INDEX IF NOT EXISTS idx_maintenance_plans_last_wo ON maintenance_plans(last_execution_work_order_id);
    `);
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }
}

module.exports = { up };
