/**
 * Migration 010 - Données de profil : épingles menu (accès rapide) par utilisateur
 */
function up(db) {
  try {
    db.exec(`ALTER TABLE users ADD COLUMN pinned_menu_items TEXT`);
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }
}

module.exports = { up };
