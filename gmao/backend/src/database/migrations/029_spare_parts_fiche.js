/**
 * Migration 029 - Fiche stock : image et détails complémentaires pour les pièces
 * image_data : base64 (TEXT), location : emplacement physique, manufacturer_reference : référence constructeur
 */
function up(db) {
  const cols = [
    { name: 'image_data', sql: 'ALTER TABLE spare_parts ADD COLUMN image_data TEXT' },
    { name: 'location', sql: 'ALTER TABLE spare_parts ADD COLUMN location TEXT' },
    { name: 'manufacturer_reference', sql: 'ALTER TABLE spare_parts ADD COLUMN manufacturer_reference TEXT' }
  ];
  for (const col of cols) {
    try {
      db.prepare(col.sql).run();
    } catch (e) {
      if (!e.message || !e.message.includes('duplicate column')) throw e;
    }
  }
}

module.exports = { up };
