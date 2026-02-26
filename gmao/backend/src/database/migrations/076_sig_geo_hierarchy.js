/**
 * Migration 076 - SIG : géolocalisation et localisation littéraire pour départements, lignes, machines et sections
 * Permet une localisation précise à tous les niveaux de la hiérarchie (site → département → ligne → machine → section).
 */

function up(db) {
  // Départements : latitude, longitude, localisation littéraire (adresse / description précise)
  try {
    db.prepare('SELECT latitude FROM departements LIMIT 1').get();
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      db.exec('ALTER TABLE departements ADD COLUMN latitude REAL');
      db.exec('ALTER TABLE departements ADD COLUMN longitude REAL');
      db.exec('ALTER TABLE departements ADD COLUMN location_address TEXT');
      db.exec('CREATE INDEX IF NOT EXISTS idx_departements_geo ON departements(latitude, longitude)');
    }
  }

  // Lignes : latitude, longitude, localisation littéraire
  try {
    db.prepare('SELECT latitude FROM lignes LIMIT 1').get();
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      db.exec('ALTER TABLE lignes ADD COLUMN latitude REAL');
      db.exec('ALTER TABLE lignes ADD COLUMN longitude REAL');
      db.exec('ALTER TABLE lignes ADD COLUMN location_address TEXT');
      db.exec('CREATE INDEX IF NOT EXISTS idx_lignes_geo ON lignes(latitude, longitude)');
    }
  }

  // Équipements (machines, sections) : latitude, longitude, localisation littéraire (en plus du champ location existant)
  try {
    db.prepare('SELECT latitude FROM equipment LIMIT 1').get();
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      db.exec('ALTER TABLE equipment ADD COLUMN latitude REAL');
      db.exec('ALTER TABLE equipment ADD COLUMN longitude REAL');
      db.exec('ALTER TABLE equipment ADD COLUMN location_address TEXT');
      db.exec('CREATE INDEX IF NOT EXISTS idx_equipment_geo ON equipment(latitude, longitude)');
    }
  }
}

function down(db) {}

module.exports = { up, down };
