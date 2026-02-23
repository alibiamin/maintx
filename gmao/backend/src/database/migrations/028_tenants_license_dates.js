/**
 * Migration 028 - Licence par période : date début / date fin pour les tenants.
 * Après la date de fin, les utilisateurs du client ne peuvent plus se connecter jusqu'à une prochaine activation.
 */
function up(db) {
  try {
    db.prepare('ALTER TABLE tenants ADD COLUMN license_start TEXT').run();
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }
  try {
    db.prepare('ALTER TABLE tenants ADD COLUMN license_end TEXT').run();
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }
}

module.exports = { up };
