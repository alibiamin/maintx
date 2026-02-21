/**
 * Migration 011 - Taux horaire par technicien (coûts main d'œuvre)
 */
function up(db) {
  try {
    db.exec(`ALTER TABLE users ADD COLUMN hourly_rate REAL`);
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }
}

module.exports = { up };
