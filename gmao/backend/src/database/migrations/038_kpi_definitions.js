/**
 * Migration 038 - Indicateurs KPI configurables par l'utilisateur
 * Table kpi_definitions : nom, source (clé métier), ordre, couleur, icône, visible
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS kpi_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      source_key TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      color TEXT DEFAULT 'primary',
      icon TEXT,
      is_visible INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM kpi_definitions').get();
    if (count && count.c > 0) return;
    const defaults = [
      ['Disponibilité équipements', 'availabilityRate', 0, 'primary', 'Speed', 1],
      ['Respect plans préventifs', 'preventiveComplianceRate', 1, 'success', 'Schedule', 1],
      ['Coût maintenance (période)', 'totalCostPeriod', 2, 'warning', 'Euro', 1],
      ['MTTR (temps moyen réparation)', 'mttr', 3, 'info', 'Build', 1],
      ['MTBF (entre pannes)', 'mtbf', 4, 'success', 'TrendingUp', 1],
      ['OT en retard (SLA)', 'slaBreached', 5, 'error', 'Warning', 1]
    ];
    const stmt = db.prepare(`
      INSERT INTO kpi_definitions (name, source_key, order_index, color, icon, is_visible)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const row of defaults) {
      stmt.run(...row);
    }
  } catch (e) {
    if (e.message && !e.message.includes('no such table')) throw e;
  }
}

module.exports = { up };
