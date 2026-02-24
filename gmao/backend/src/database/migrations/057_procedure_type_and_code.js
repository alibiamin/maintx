/**
 * Migration 057 - Type de procédure et code (maintenance / mode opératoire de test)
 * Permet de distinguer : procédure de maintenance, mode opératoire de test, mode opératoire général.
 */
function up(db) {
  try {
    db.exec('ALTER TABLE procedures ADD COLUMN procedure_type TEXT DEFAULT \'maintenance\'');
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }
  try {
    db.exec('ALTER TABLE procedures ADD COLUMN code TEXT');
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_procedures_type ON procedures(procedure_type)');
  } catch (e) {
    if (!e.message || !e.message.includes('already exists')) throw e;
  }
}

module.exports = { up };
