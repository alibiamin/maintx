/**
 * Migration 024 - Immobilisations / actifs (valeur, amortissement)
 */
function up(db) {
  const cols = [
    'acquisition_value REAL',
    'depreciation_years INTEGER',
    'residual_value REAL',
    'depreciation_start_date DATE'
  ];
  cols.forEach((colDef) => {
    const colName = colDef.split(' ')[0];
    try {
      db.exec(`ALTER TABLE equipment ADD COLUMN ${colDef}`);
    } catch (e) {
      if (!e.message || !e.message.includes('duplicate column name')) throw e;
    }
  });
}

module.exports = { up };
