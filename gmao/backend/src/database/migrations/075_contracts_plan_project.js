/**
 * Migration 075 - Contrats de sous-traitance liés à un OT, un plan de maintenance ou un projet
 */

function up(db) {
  try {
    db.prepare('SELECT 1 FROM maintenance_contracts LIMIT 1').get();
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return;
    throw e;
  }
  try {
    db.prepare('SELECT work_order_id FROM maintenance_contracts LIMIT 1').get();
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      db.exec('ALTER TABLE maintenance_contracts ADD COLUMN work_order_id INTEGER REFERENCES work_orders(id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_maintenance_contracts_wo ON maintenance_contracts(work_order_id)');
    }
  }
  try {
    db.prepare('SELECT maintenance_plan_id FROM maintenance_contracts LIMIT 1').get();
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      db.exec('ALTER TABLE maintenance_contracts ADD COLUMN maintenance_plan_id INTEGER REFERENCES maintenance_plans(id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_maintenance_contracts_plan ON maintenance_contracts(maintenance_plan_id)');
    }
  }
  try {
    db.prepare('SELECT maintenance_project_id FROM maintenance_contracts LIMIT 1').get();
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      db.exec('ALTER TABLE maintenance_contracts ADD COLUMN maintenance_project_id INTEGER REFERENCES maintenance_projects(id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_maintenance_contracts_project ON maintenance_contracts(maintenance_project_id)');
    }
  }
}

function down(db) {}

module.exports = { up, down };
