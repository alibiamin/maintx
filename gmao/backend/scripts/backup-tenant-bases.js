/**
 * Sauvegarde quotidienne des bases tenant + gmao.db (admin).
 * À planifier (cron / Task Scheduler) : 1 exécution par jour.
 * Conservation des backups : 7 à 30 jours (BACKUP_RETENTION_DAYS).
 *
 * Usage : depuis la racine backend : node scripts/backup-tenant-bases.js
 *
 * Test de restauration : au moins 1 fois par mois, restaurer un backup sur un
 * tenant de test (copier backups/YYYY-MM-DD/client_xxx.db vers data/ et vérifier l'app).
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const RETENTION_DAYS = Math.min(30, Math.max(7, parseInt(process.env.BACKUP_RETENTION_DAYS, 10) || 30));
const dataDir = path.join(__dirname, '..', 'data');
const backupRoot = path.join(dataDir, 'backups');

async function run() {
  const db = require(path.join(__dirname, '..', 'src', 'database', 'db'));
  await db.init();

  const adminDb = db.getAdminDb();
  const dateStr = new Date().toISOString().slice(0, 10);
  const backupDir = path.join(backupRoot, dateStr);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  let copied = 0;

  // 1) Sauvegarde base admin (gmao.db)
  const gmaoPath = path.join(dataDir, process.env.GMAO_DB_PATH || 'gmao.db');
  if (fs.existsSync(gmaoPath)) {
    const dest = path.join(backupDir, path.basename(gmaoPath));
    fs.copyFileSync(gmaoPath, dest);
    console.log('[backup]', path.basename(gmaoPath), '->', dateStr + '/');
    copied++;
  }

  // 2) Sauvegarde bases client (une par tenant)
  let tenants = [];
  try {
    tenants = adminDb.prepare('SELECT id, db_filename FROM tenants').all();
  } catch (e) {
    if (!e.message || !e.message.includes('no such table')) throw e;
  }

  for (const t of tenants) {
    const filename = t.db_filename && t.db_filename.endsWith('.db') ? t.db_filename : `${t.db_filename || 'client_' + t.id}.db`;
    const src = path.join(dataDir, filename);
    if (fs.existsSync(src)) {
      const dest = path.join(backupDir, filename);
      fs.copyFileSync(src, dest);
      console.log('[backup]', filename, '->', dateStr + '/');
      copied++;
    }
  }

  // 3) Rétention : supprimer les dossiers de backup plus vieux que RETENTION_DAYS
  if (fs.existsSync(backupRoot)) {
    const now = new Date();
    const dirs = fs.readdirSync(backupRoot, { withFileTypes: true }).filter(d => d.isDirectory());
    for (const d of dirs) {
      const match = d.name.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) continue;
      const dirDate = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
      const ageDays = (now - dirDate) / (24 * 60 * 60 * 1000);
      if (ageDays > RETENTION_DAYS) {
        fs.rmSync(path.join(backupRoot, d.name), { recursive: true });
        console.log('[backup] rétention: supprimé', d.name);
      }
    }
  }

  console.log('[backup] terminé:', copied, 'fichier(s) sauvegardés, rétention', RETENTION_DAYS, 'jours.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[backup] Erreur:', err.message);
  process.exit(1);
});
