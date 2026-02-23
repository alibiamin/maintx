/**
 * Migration 037 - Supprime les doublons dans la table units (garder un seul enregistrement par nom)
 * et redirige spare_parts.unit_id vers l'id conservé si besoin.
 */
function up(db) {
  try {
    const duplicates = db.prepare(`
      SELECT name, MIN(id) as keep_id FROM units GROUP BY name HAVING COUNT(*) > 1
    `).all();
    for (const { name, keep_id } of duplicates) {
      const toDelete = db.prepare('SELECT id FROM units WHERE name = ? AND id != ?').all(name, keep_id);
      for (const row of toDelete) {
        db.prepare('UPDATE spare_parts SET unit_id = ? WHERE unit_id = ?').run(keep_id, row.id);
        db.prepare('DELETE FROM units WHERE id = ?').run(row.id);
      }
    }
    try {
      db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_units_name ON units(name)').run();
    } catch (e) {
      if (!e.message || !e.message.includes('duplicate column')) throw e;
    }
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return;
    throw e;
  }
}

module.exports = { up };
