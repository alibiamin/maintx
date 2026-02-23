/**
 * Exécute toutes les migrations
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
const db = require('./db');

async function run() {
  await db.init();
  const adminDb = db.getAdminDb();
  const migrationsDir = __dirname + '/migrations';
  if (!fs.existsSync(migrationsDir)) {
    console.log('Aucune migration trouvée');
    db.close();
    return;
  }
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js')).sort();
  for (const f of files) {
    try {
      const m = require(path.join(migrationsDir, f));
      if (m.up) {
        m.up(adminDb);
        console.log('✅ Migration:', f);
      } else if (m.migrate) {
        m.migrate(adminDb);
        console.log('✅ Migration:', f);
      }
    } catch (err) {
      if (err.message && (err.message.includes('already exists') || err.message.includes('duplicate'))) {
        console.log('⏭️  Migration (déjà appliquée):', f);
      } else {
        throw err;
      }
    }
  }
  if (adminDb._save) adminDb._save();
  db.close();
  console.log('Migrations terminées');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Erreur migration:', err);
  process.exit(1);
});
