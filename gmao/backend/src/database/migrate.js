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
  const migrationsDir = __dirname + '/migrations';
  if (!fs.existsSync(migrationsDir)) {
    console.log('Aucune migration trouvée');
    db.close();
    return;
  }
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js')).sort();
  for (const f of files) {
    const m = require(path.join(migrationsDir, f));
    if (m.up) {
      m.up(db);
      console.log('✅ Migration:', f);
    } else if (m.migrate) {
      m.migrate(db);
      console.log('✅ Migration:', f);
    }
  }
  db._save();
  db.close();
  console.log('Migrations terminées');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Erreur migration:', err);
  process.exit(1);
});
