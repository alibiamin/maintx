/**
 * Migration 041 - Objectifs des indicateurs (targets)
 * Table indicator_targets : clé, libellé, valeur cible, direction (min/max), unité, référence norme
 * Valeurs par défaut conformes à la norme EN 15341 et bonnes pratiques
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS indicator_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      target_value REAL NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('min', 'max')),
      unit TEXT DEFAULT '',
      ref_label TEXT DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const count = db.prepare('SELECT COUNT(*) as c FROM indicator_targets').get();
  if (count && count.c > 0) return;
  const defaults = [
    ['availability', 'Disponibilité équipements', 85, 'min', '%', 'Seuil min. (réf. EN 15341)', 0],
    ['preventive_compliance', 'Taux de respect plans préventifs', 90, 'min', '%', 'Objectif', 1],
    ['sla_breached', 'OT en dépassement SLA', 0, 'max', '', 'Objectif 0', 2],
    ['backlog', 'Backlog (en attente + en cours)', 10, 'max', 'OT', 'À maîtriser', 3],
    ['overdue_plans', 'Plans préventifs en retard', 0, 'max', '', 'Objectif 0', 4],
    ['stock_alerts', 'Alertes stock (sous seuil)', 0, 'max', 'réf.', 'Objectif 0', 5],
    ['mttr', 'MTTR moyen (heures)', 24, 'max', 'h', 'À minimiser', 6],
    ['mtbf', 'MTBF moyen (jours)', 30, 'min', 'j', 'À maximiser', 7]
  ];
  const stmt = db.prepare(`
    INSERT INTO indicator_targets (key, label, target_value, direction, unit, ref_label, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const row of defaults) {
    stmt.run(...row);
  }
}

module.exports = { up };
