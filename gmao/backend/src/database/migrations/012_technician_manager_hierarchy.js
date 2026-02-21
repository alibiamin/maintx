/**
 * Migration 012 - Hiérarchie équipe : responsable / manager par technicien
 */
function up(db) {
  try {
    db.exec(`ALTER TABLE users ADD COLUMN manager_id INTEGER REFERENCES users(id)`);
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }
}

module.exports = { up };
