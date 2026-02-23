/**
 * Service d'audit — enregistrement des créations / modifications / suppressions
 * Multi-tenant : db (req.db) doit être passé par l'appelant.
 */

/**
 * @param {object} db - base de données (req.db)
 * @param {string} entityType - equipment, work_order, user, settings, etc.
 * @param {string|number} entityId - id de l'entité
 * @param {'created'|'updated'|'deleted'} action
 * @param {object} options - { userId, userEmail, summary }
 */
function log(db, entityType, entityId, action, options = {}) {
  if (!db) return;
  try {
    db.prepare(`
      INSERT INTO audit_log (entity_type, entity_id, action, user_id, user_email, summary)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      entityType,
      entityId != null ? String(entityId) : null,
      action,
      options.userId ?? null,
      options.userEmail ?? null,
      options.summary ?? null
    );
  } catch (e) {
    if (!e.message || !e.message.includes('no such table')) console.warn('[audit]', e.message);
  }
}

module.exports = { log };
