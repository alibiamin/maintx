/**
 * Migration 068 - Modules activables par tenant (base admin gmao.db)
 * enabled_modules : JSON array de codes de modules, ou NULL = tous activés (rétrocompatibilité).
 */

function up(db) {
  try {
    db.prepare('ALTER TABLE tenants ADD COLUMN enabled_modules TEXT').run();
  } catch (e) {
    if (!e.message || (!e.message.includes('duplicate column') && !e.message.includes('already exists'))) throw e;
  }
  console.log('✅ Migration 068 : tenants.enabled_modules');
}

module.exports = { up };
