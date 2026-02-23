/**
 * Script une fois : supprime tous les utilisateurs dont l'email se termine par @xmaint.org
 * À lancer depuis la racine backend : node scripts/delete-users-xmaint.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function run() {
  const db = require(path.join(__dirname, '..', 'src', 'database', 'db'));
  await db.init();
  const adminDb = db.getAdminDb();

  const domain = '@xmaint.org';
  const users = adminDb.prepare(
    'SELECT id, email, first_name, last_name FROM users WHERE email LIKE ?'
  ).all('%' + domain);

  if (users.length === 0) {
    console.log('Aucun utilisateur avec email @xmaint.org trouvé.');
    process.exit(0);
    return;
  }

  console.log('Utilisateurs à supprimer (@xmaint.org) :');
  users.forEach((u) => console.log('  -', u.id, u.email, u.first_name, u.last_name));

  const ids = users.map((u) => u.id);

  try {
    adminDb.prepare('UPDATE users SET manager_id = NULL WHERE manager_id IN (' + ids.map(() => '?').join(',') + ')').run(...ids);
    adminDb.prepare('DELETE FROM users WHERE id IN (' + ids.map(() => '?').join(',') + ')').run(...ids);
    if (adminDb._save) adminDb._save();
    console.log(users.length, 'utilisateur(s) supprimé(s).');
  } catch (e) {
    console.error('Erreur:', e.message);
    process.exit(1);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
