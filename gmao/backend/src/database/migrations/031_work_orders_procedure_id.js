/**
 * Migration 031 - Lier les OT et la maintenance préventive aux procédures / modes opératoires
 * work_orders.procedure_id : procédure à suivre pour réaliser l'OT (comme les checklists)
 */
function up(db) {
  try {
    db.exec('ALTER TABLE work_orders ADD COLUMN procedure_id INTEGER REFERENCES procedures(id)');
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column name')) throw e;
  }
}

module.exports = { up };
