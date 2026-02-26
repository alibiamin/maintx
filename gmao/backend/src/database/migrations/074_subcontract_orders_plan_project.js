/**
 * Migration 074 - Ordres de sous-traitance liés à un OT, un plan de maintenance ou un projet
 */

function up(db) {
  try {
    db.prepare('SELECT 1 FROM subcontract_orders LIMIT 1').get();
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return;
    throw e;
  }
  try {
    db.prepare('SELECT maintenance_plan_id FROM subcontract_orders LIMIT 1').get();
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      db.exec('ALTER TABLE subcontract_orders ADD COLUMN maintenance_plan_id INTEGER REFERENCES maintenance_plans(id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_subcontract_orders_plan ON subcontract_orders(maintenance_plan_id)');
    }
  }
  try {
    db.prepare('SELECT maintenance_project_id FROM subcontract_orders LIMIT 1').get();
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      db.exec('ALTER TABLE subcontract_orders ADD COLUMN maintenance_project_id INTEGER REFERENCES maintenance_projects(id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_subcontract_orders_project ON subcontract_orders(maintenance_project_id)');
    }
  }
}

function down(db) {}

module.exports = { up, down };
