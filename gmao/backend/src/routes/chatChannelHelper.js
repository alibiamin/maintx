/**
 * Helper : canal de chat par OT — création automatique et synchronisation des membres
 * (assigné principal + opérateurs / techniciens assignés).
 * Utilisé par workOrders (création, mise à jour) et chat (by-link).
 */

/**
 * Crée le canal pour l'OT s'il n'existe pas et synchronise les membres.
 * @param {object} db - Base client (req.db)
 * @param {number} workOrderId - ID de l'OT
 * @param {string} channelName - Nom du canal (ex. "OT 2025-001")
 * @param {number} createdBy - User id du créateur
 * @param {number[]} memberUserIds - Liste des user id à ajouter (créateur + assigné + opérateurs)
 * @returns {number|null} channel id ou null si tables absentes
 */
function ensureWorkOrderChannel(db, workOrderId, channelName, createdBy, memberUserIds) {
  if (!db || !workOrderId) return null;
  try {
    const existing = db.prepare(`
      SELECT id FROM chat_channels WHERE linked_type = 'work_order' AND linked_id = ?
    `).get(workOrderId);

    const uniqueIds = [...new Set([createdBy, ...(memberUserIds || [])].filter(Boolean))];
    let channelId;

    if (existing) {
      channelId = existing.id;
      db.prepare('DELETE FROM chat_channel_members WHERE channel_id = ?').run(channelId);
    } else {
      const run = db.prepare(`
        INSERT INTO chat_channels (name, type, linked_type, linked_id, created_by)
        VALUES (?, 'work_order', 'work_order', ?, ?)
      `).run(channelName || `OT ${workOrderId}`, workOrderId, createdBy || null);
      channelId = run.lastInsertRowid;
    }

    const ins = db.prepare('INSERT OR IGNORE INTO chat_channel_members (channel_id, user_id) VALUES (?, ?)');
    for (const uid of uniqueIds) {
      if (uid) ins.run(channelId, uid);
    }
    return channelId;
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return null;
    console.warn('[chatChannelHelper]', e.message);
    return null;
  }
}

/**
 * Récupère les user ids des techniciens assignés à l'OT (assigned_to + work_order_operators).
 */
function getWorkOrderMemberIds(db, workOrderId) {
  if (!db || !workOrderId) return [];
  try {
    const wo = db.prepare('SELECT assigned_to, created_by FROM work_orders WHERE id = ?').get(workOrderId);
    if (!wo) return [];
    const operatorRows = db.prepare('SELECT user_id FROM work_order_operators WHERE work_order_id = ?').all(workOrderId);
    const ids = [wo.assigned_to, wo.created_by, ...(operatorRows || []).map((r) => r.user_id)].filter(Boolean);
    return [...new Set(ids)];
  } catch (_) {
    return [];
  }
}

/**
 * Envoie une notification système dans le chat de l'OT après mise à jour.
 * @param {object} db - Base client (req.db)
 * @param {number} workOrderId - ID de l'OT
 * @param {number} userId - User id de la personne qui a fait la mise à jour
 * @param {string} message - Texte de la notification (ex. "OT mis à jour : statut En cours, assigné à Marie Martin")
 */
function postWorkOrderUpdateNotification(db, workOrderId, userId, message) {
  if (!db || !workOrderId || !message) return;
  const effectiveUserId = (userId != null && userId !== '') ? Number(userId) : 0;
  try {
    const ch = db.prepare(`
      SELECT id FROM chat_channels WHERE linked_type = 'work_order' AND linked_id = ?
    `).get(workOrderId);
    if (!ch) return;
    const content = (message || 'OT mis à jour').slice(0, 500);
    const isMessageTypeColumnMissing = (msg) => msg && (String(msg).includes('no such column') || String(msg).includes('has no column') || String(msg).includes('message_type'));
    try {
      db.prepare(`
        INSERT INTO chat_messages (channel_id, user_id, content, message_type)
        VALUES (?, ?, ?, 'system')
      `).run(ch.id, effectiveUserId, content);
    } catch (e) {
      if (isMessageTypeColumnMissing(e.message)) {
        try {
          db.prepare('ALTER TABLE chat_messages ADD COLUMN message_type TEXT DEFAULT \'user\'').run();
        } catch (alterErr) {
          if (!alterErr.message || (!alterErr.message.includes('duplicate') && !alterErr.message.includes('already exists'))) { /* ignore */ }
        }
        try {
          db.prepare(`
            INSERT INTO chat_messages (channel_id, user_id, content, message_type)
            VALUES (?, ?, ?, 'system')
          `).run(ch.id, effectiveUserId, content);
        } catch (e2) {
          if (isMessageTypeColumnMissing(e2.message)) {
            db.prepare(`
              INSERT INTO chat_messages (channel_id, user_id, content)
              VALUES (?, ?, ?)
            `).run(ch.id, effectiveUserId, content);
          } else throw e2;
        }
      } else throw e;
    }
    if (typeof db._save === 'function') db._save();
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return;
    console.warn('[chatChannelHelper] postWorkOrderUpdateNotification', e.message);
  }
}

module.exports = { ensureWorkOrderChannel, getWorkOrderMemberIds, postWorkOrderUpdateNotification };
