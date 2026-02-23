/**
 * Migration 030 - Statuts de stock (A Accepté, Q Quarantaine, R Rejeté) et contrôle qualité
 * stock_balance : quantity_accepted, quantity_quarantine, quantity_rejected
 * stock_movements : status (A/Q/R) pour traçabilité
 * quality_control_log : historique libération / rejet
 */

function up(db) {
  // stock_balance : répartition par statut
  for (const col of ['quantity_accepted', 'quantity_quarantine', 'quantity_rejected']) {
    try {
      db.prepare(`ALTER TABLE stock_balance ADD COLUMN ${col} INTEGER DEFAULT 0`).run();
    } catch (e) {
      if (!e.message || !e.message.includes('duplicate column')) throw e;
    }
  }
  // Backfill : tout le stock existant = accepté
  try {
    db.prepare(`
      UPDATE stock_balance SET quantity_accepted = quantity, quantity_quarantine = 0, quantity_rejected = 0
      WHERE quantity_accepted IS NULL OR quantity_accepted = 0
    `).run();
  } catch (_) {}

  // stock_movements : statut du mouvement (entrée A ou Q)
  try {
    db.prepare("ALTER TABLE stock_movements ADD COLUMN status TEXT DEFAULT 'A'").run();
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }

  // Table historique contrôle qualité
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS quality_control_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        spare_part_id INTEGER NOT NULL REFERENCES spare_parts(id),
        quantity INTEGER NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('release', 'reject')),
        user_id INTEGER REFERENCES users(id),
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (e) {
    if (!e.message || !e.message.includes('already exists')) throw e;
  }
}

module.exports = { up };
