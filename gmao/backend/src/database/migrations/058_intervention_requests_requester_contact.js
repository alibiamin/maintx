/**
 * Migration 058 - Demandes d'intervention : coordonnées du demandeur (portail public)
 * Permet le formulaire de demande d'intervention sans login (nom, email, téléphone).
 */
function up(db) {
  const cols = [
    { name: 'requester_name', sql: 'ALTER TABLE intervention_requests ADD COLUMN requester_name TEXT' },
    { name: 'requester_email', sql: 'ALTER TABLE intervention_requests ADD COLUMN requester_email TEXT' },
    { name: 'requester_phone', sql: 'ALTER TABLE intervention_requests ADD COLUMN requester_phone TEXT' }
  ];
  for (const { sql } of cols) {
    try {
      db.exec(sql);
    } catch (e) {
      if (!e.message || !e.message.includes('duplicate column')) throw e;
    }
  }
}

module.exports = { up };
