/**
 * Migration 035 - Rattacher des plans de maintenance à un projet
 * maintenance_plans.project_id : projet auquel le plan est rattaché
 */
function up(db) {
  try {
    db.exec('ALTER TABLE maintenance_plans ADD COLUMN project_id INTEGER REFERENCES maintenance_projects(id)');
  } catch (e) {
    if (e.message && !e.message.includes('duplicate column name')) throw e;
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_maintenance_plans_project ON maintenance_plans(project_id)');
}

module.exports = { up };
