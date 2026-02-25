/**
 * Supprime physiquement les fichiers .db des tenants déjà en soft delete (status=deleted)
 * dont deleted_at est antérieur au délai configuré. À exécuter après le délai de récupération
 * (ex. 30 jours). Ne supprime pas l'enregistrement tenant dans gmao.db (historique).
 *
 * Usage : node scripts/purge-deleted-tenant-dbs.js
 * Env : PURGE_DELETED_AFTER_DAYS (défaut 30)
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PURGE_AFTER_DAYS = parseInt(process.env.PURGE_DELETED_AFTER_DAYS, 10) || 30;

async function run() {
  const db = require(path.join(__dirname, '..', 'src', 'database', 'db'));
  await db.init();

  const adminDb = db.getAdminDb();
  const dataDir = path.join(__dirname, '..', 'data');

  let tenantsToPurge = [];
  try {
    tenantsToPurge = adminDb.prepare(`
      SELECT id, name, db_filename, deleted_at
      FROM tenants
      WHERE status = 'deleted' AND deleted_at IS NOT NULL
        AND datetime(deleted_at) < datetime('now', ?)
    `).all('-' + PURGE_AFTER_DAYS + ' days');
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      console.log('[purge] Colonnes status/deleted_at absentes. Rien à purger.');
      process.exit(0);
      return;
    }
    throw e;
  }

  for (const t of tenantsToPurge) {
    const filename = t.db_filename;
    if (!filename || filename === 'default.db') continue;
    const filePath = path.join(dataDir, filename);
    if (db.removeClientDbFromCache) db.removeClientDbFromCache(filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log('[purge] Fichier supprimé:', filename, '(tenant', t.id, t.name + ')');
      } catch (e) {
        console.warn('[purge] Impossible de supprimer', filePath, e.message);
      }
    }
  }

  if (tenantsToPurge.length === 0) {
    console.log('[purge] Aucun tenant à purger (délai', PURGE_AFTER_DAYS, 'jours).');
  }
  process.exit(0);
}

run().catch((err) => {
  console.error('[purge] Erreur:', err.message);
  process.exit(1);
});
