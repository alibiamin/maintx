/**
 * Migration 042 - Objectif indicateur budget période
 * Ajoute l'objectif "budget période" pour comparaison avec le coût période (coût ≤ budget).
 */
function up(db) {
  const existing = db.prepare('SELECT 1 FROM indicator_targets WHERE key = ?').get('budget_period');
  if (existing) return;
  db.prepare(`
    INSERT INTO indicator_targets (key, label, target_value, direction, unit, ref_label, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('budget_period', 'Budget période (coût max)', 50000, 'max', '', 'Budget à ne pas dépasser', 8);
}

module.exports = { up };
