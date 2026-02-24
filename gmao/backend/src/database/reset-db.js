/**
 * Réinitialisation complète des bases : supprime gmao.db et default.db.
 * Au prochain démarrage du serveur, des bases neuves seront créées avec
 * le schéma admin (gmao.db) + tenant Démo + base client (default.db) et
 * données de test dans toutes les tables.
 *
 * Usage : npm run reset-db
 * Puis  : npm start
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
const gmaoPath = path.join(dataDir, process.env.GMAO_DB_PATH || 'gmao.db');
const defaultPath = path.join(dataDir, process.env.GMAO_DEFAULT_CLIENT_DB || 'default.db');

if (!fs.existsSync(dataDir)) {
  console.log('Dossier data/ absent, rien à supprimer.');
  process.exit(0);
}

let removed = 0;
if (fs.existsSync(gmaoPath)) {
  fs.unlinkSync(gmaoPath);
  console.log('🗑️  Supprimé : gmao.db (base admin)');
  removed++;
}
if (fs.existsSync(defaultPath)) {
  fs.unlinkSync(defaultPath);
  console.log('🗑️  Supprimé : default.db (base client démo)');
  removed++;
}

if (removed === 0) {
  console.log('Aucune base à supprimer (déjà vierge).');
} else {
  console.log('\n✅ Bases réinitialisées. Démarrez le serveur (npm start) pour recréer gmao.db et default.db avec des données de test.');
}
process.exit(0);
