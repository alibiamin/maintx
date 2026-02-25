/**
 * Migration 066 - Révocation JWT (base admin gmao.db)
 * revoked_at : quand l'utilisateur est désactivé, les tokens émis avant cette date sont rejetés.
 */

function up(db) {
  try {
    db.exec('ALTER TABLE users ADD COLUMN revoked_at DATETIME');
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }
  console.log('✅ Migration 066 : users.revoked_at');
}

module.exports = { up };
