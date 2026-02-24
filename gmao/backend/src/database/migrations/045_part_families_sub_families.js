/**
 * Migration 045 - Familles de pièces : 5 sous-familles (aligné avec stock family + sub_family_1..5)
 */
function up(db) {
  const cols = ['sub_family_1', 'sub_family_2', 'sub_family_3', 'sub_family_4', 'sub_family_5'];
  for (const col of cols) {
    try {
      db.exec(`ALTER TABLE part_families ADD COLUMN ${col} TEXT`);
    } catch (e) {
      if (!e.message || !e.message.includes('duplicate column name')) throw e;
    }
  }
}

module.exports = { up };
