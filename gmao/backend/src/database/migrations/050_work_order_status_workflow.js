/**
 * Migration 050 (base client) - Workflow OT : étape "à valider"
 * Colonne status_workflow : 'draft' | 'planned' | 'in_progress' | 'to_validate' | 'closed' (affichage et transitions).
 * status reste le champ principal (pending, in_progress, completed, etc.) pour compatibilité.
 */
function up(db) {
  try {
    db.exec("ALTER TABLE work_orders ADD COLUMN status_workflow TEXT DEFAULT NULL");
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }
}

module.exports = { up };
