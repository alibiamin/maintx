/**
 * Migration 065 - Cycle de vie du tenant (base admin gmao.db)
 * status: trial | active | suspended | expired | deleted
 * deleted_at: soft delete (conservation des données pour restauration)
 */

function up(db) {
  try {
    db.exec(`ALTER TABLE tenants ADD COLUMN status TEXT DEFAULT 'active'`);
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }
  try {
    db.exec(`ALTER TABLE tenants ADD COLUMN deleted_at DATETIME`);
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }
  try {
    db.exec(`UPDATE tenants SET status = 'active' WHERE status IS NULL OR status = ''`);
  } catch (_) {}
  console.log('✅ Migration 065 : tenant status + deleted_at');
}

module.exports = { up };
