/**
 * Migration 027 - Lier les utilisateurs à un tenant (NULL = admin MAINTX, non NULL = utilisateur client)
 */
function up(db) {
  try {
    db.exec('ALTER TABLE users ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)');
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }
}

module.exports = { up };
