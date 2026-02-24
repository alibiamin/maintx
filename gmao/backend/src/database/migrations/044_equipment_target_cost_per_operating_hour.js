/**
 * Migration 044 - Coût cible par heure de fonctionnement (paramétrable par équipement)
 */
function up(db) {
  try {
    db.exec('ALTER TABLE equipment ADD COLUMN target_cost_per_operating_hour REAL');
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column name')) throw e;
  }
}

module.exports = { up };
