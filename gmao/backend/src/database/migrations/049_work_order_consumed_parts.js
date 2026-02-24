/**
 * Migration 049 (base client) - Pièces consommées par OT
 * Table work_order_consumed_parts : lien explicite OT ↔ pièce + quantité + coût unitaire au moment de la consommation.
 * Permet une liste dédiée "pièces consommées" sur la fiche OT et un coût pièces cohérent.
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_order_consumed_parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      spare_part_id INTEGER NOT NULL REFERENCES spare_parts(id),
      quantity REAL NOT NULL DEFAULT 1 CHECK(quantity > 0),
      unit_cost_at_use REAL,
      created_at TEXT DEFAULT (datetime('now')),
      created_by INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_wo_consumed_parts_wo ON work_order_consumed_parts(work_order_id);
    CREATE INDEX IF NOT EXISTS idx_wo_consumed_parts_part ON work_order_consumed_parts(spare_part_id);
  `);
}

module.exports = { up };
