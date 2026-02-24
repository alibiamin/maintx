/**
 * Migration 051 - Numéro de demande d'intervention (préfixe + compteur, codification)
 * Ajoute la colonne number (UNIQUE) et backfill pour les lignes existantes.
 */
function up(db) {
  try {
    db.exec('ALTER TABLE intervention_requests ADD COLUMN number TEXT');
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }
  try {
    const rows = db.prepare('SELECT id FROM intervention_requests WHERE number IS NULL OR number = \'\'').all();
    const pad = (n, len) => String(n).padStart(len, '0');
    for (const r of rows) {
      db.prepare('UPDATE intervention_requests SET number = ? WHERE id = ?').run('DI-' + pad(r.id, 4), r.id);
    }
  } catch (e) {
    if (!e.message || !e.message.includes('no such table')) throw e;
  }
  try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_intervention_requests_number ON intervention_requests(number)');
  } catch (e) {
    if (!e.message || !e.message.includes('already exists')) throw e;
  }
}

module.exports = { up };
