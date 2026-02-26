/**
 * API Chat d'équipe - Canaux et messages, liés aux OT et équipements.
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const { authenticate, requirePermission } = require('../middleware/auth');
const dbModule = require('../database/db');

/** Crée les tables chat si absentes (chaque instruction séparée pour compatibilité sql.js). */
function ensureChatTables(clientDb) {
  if (!clientDb || typeof clientDb.exec !== 'function') return;
  try {
    clientDb.exec('CREATE TABLE IF NOT EXISTS chat_channels (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT \'team\', linked_type TEXT, linked_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, created_by INTEGER)');
    clientDb.exec('CREATE INDEX IF NOT EXISTS idx_chat_channels_type ON chat_channels(type)');
    clientDb.exec('CREATE INDEX IF NOT EXISTS idx_chat_channels_linked ON chat_channels(linked_type, linked_id)');
    clientDb.exec('CREATE TABLE IF NOT EXISTS chat_channel_members (channel_id INTEGER NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE, user_id INTEGER NOT NULL, joined_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (channel_id, user_id))');
    clientDb.exec('CREATE INDEX IF NOT EXISTS idx_chat_members_channel ON chat_channel_members(channel_id)');
    clientDb.exec('CREATE TABLE IF NOT EXISTS chat_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, channel_id INTEGER NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE, user_id INTEGER NOT NULL, content TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, message_type TEXT DEFAULT \'user\')');
    clientDb.exec('CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel_id)');
    clientDb.exec('CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at)');
    try {
      clientDb.exec('CREATE TABLE IF NOT EXISTS chat_channel_reads (channel_id INTEGER NOT NULL, user_id INTEGER NOT NULL, last_read_at TEXT NOT NULL DEFAULT \'1970-01-01T00:00:00.000Z\', PRIMARY KEY (channel_id, user_id), FOREIGN KEY (channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE)');
      clientDb.exec('CREATE INDEX IF NOT EXISTS idx_chat_reads_user ON chat_channel_reads(user_id)');
    } catch (e) {
      if (!e.message || !e.message.includes('already exists')) console.warn('[chat] chat_channel_reads', e.message);
    }
    if (typeof clientDb._save === 'function') clientDb._save();
  } catch (e) {
    console.warn('[chat] ensureChatTables:', e.message);
  }
}

function getUserName(adminDb, userId) {
  if (!adminDb || !userId) return `User ${userId}`;
  try {
    const u = adminDb.prepare('SELECT first_name, last_name FROM users WHERE id = ?').get(userId);
    return u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || `User ${userId}` : `User ${userId}`;
  } catch (_) {
    return `User ${userId}`;
  }
}

/** Noms des membres d'un canal (équipe affectée) depuis la base admin. */
function getChannelTeamNames(clientDb, adminDb, channelId) {
  if (!clientDb || !adminDb || !channelId) return [];
  try {
    const rows = clientDb.prepare('SELECT user_id FROM chat_channel_members WHERE channel_id = ?').all(channelId);
    return (rows || []).map((r) => getUserName(adminDb, r.user_id)).filter(Boolean);
  } catch (_) {
    return [];
  }
}

const router = express.Router();
router.use(authenticate);
router.use(requirePermission('chat', 'view'));

/** Total des messages non lus (pour badge menu). */
router.get('/unread-total', (req, res) => {
  const db = req.db;
  ensureChatTables(db);
  const userId = req.user.id;
  const hasReadsTable = (() => { try { db.prepare('SELECT 1 FROM chat_channel_reads LIMIT 1').get(); return true; } catch (_) { return false; } })();
  try {
    let total = 0;
    if (hasReadsTable) {
      const rows = db.prepare(`
        SELECT c.id FROM chat_channels c
        LEFT JOIN chat_channel_members m ON m.channel_id = c.id AND m.user_id = ?
        WHERE c.type = 'team' OR m.user_id IS NOT NULL
      `).all(userId);
      const roleName = (req.user.role_name || '').toLowerCase();
      const canSeeAll = roleName === 'administrateur' || roleName === 'responsable_maintenance';
      const channelIds = canSeeAll
        ? db.prepare('SELECT id FROM chat_channels').all().map((r) => r.id)
        : rows.map((r) => r.id);
      for (const cid of channelIds) {
        const r = db.prepare(`
          SELECT COUNT(*) AS n FROM chat_messages m
          WHERE m.channel_id = ?
            AND m.created_at > COALESCE(REPLACE(REPLACE((SELECT last_read_at FROM chat_channel_reads WHERE channel_id = ? AND user_id = ?), 'T', ' '), 'Z', ''), '1970-01-01 00:00:00')
        `).get(cid, cid, userId);
        total += r?.n ?? 0;
      }
    }
    res.json({ total });
  } catch (err) {
    if (err.message && err.message.includes('no such table')) return res.json({ total: 0 });
    res.status(500).json({ error: err.message });
  }
});

/** Liste des canaux : membres + canaux team ; admins et responsables voient tous les canaux. */
router.get('/channels', (req, res) => {
  const db = req.db;
  ensureChatTables(db);
  const userId = req.user.id;
  const roleName = (req.user.role_name || '').toLowerCase();
  const canSeeAll = roleName === 'administrateur' || roleName === 'responsable_maintenance';
  const adminDb = dbModule.getAdminDb && dbModule.getAdminDb();
  try {
    let channels;
    const hasReadsTable = (() => { try { db.prepare('SELECT 1 FROM chat_channel_reads LIMIT 1').get(); return true; } catch (_) { return false; } })();
    if (canSeeAll) {
      channels = db.prepare(`
        SELECT c.id, c.name, c.type, c.linked_type, c.linked_id, c.created_at, c.created_by,
               (SELECT COUNT(*) FROM chat_messages m WHERE m.channel_id = c.id) AS message_count,
               (SELECT MAX(m2.created_at) FROM chat_messages m2 WHERE m2.channel_id = c.id) AS last_message_at
        FROM chat_channels c
        ORDER BY last_message_at DESC, c.name ASC
      `).all();
    } else {
      channels = db.prepare(`
        SELECT c.id, c.name, c.type, c.linked_type, c.linked_id, c.created_at, c.created_by,
               (SELECT COUNT(*) FROM chat_messages m WHERE m.channel_id = c.id) AS message_count,
               (SELECT MAX(m2.created_at) FROM chat_messages m2 WHERE m2.channel_id = c.id) AS last_message_at
        FROM chat_channels c
        LEFT JOIN chat_channel_members m ON m.channel_id = c.id AND m.user_id = ?
        WHERE c.type = 'team' OR m.user_id IS NOT NULL
        ORDER BY last_message_at DESC, c.name ASC
      `).all(userId);
    }

    const withMeta = channels.map((ch) => {
      let unreadCount = 0;
      if (hasReadsTable) {
        try {
          const r = db.prepare(`
            SELECT COUNT(*) AS n FROM chat_messages m
            WHERE m.channel_id = ?
              AND m.created_at > COALESCE(REPLACE(REPLACE((SELECT last_read_at FROM chat_channel_reads WHERE channel_id = ? AND user_id = ?), 'T', ' '), 'Z', ''), '1970-01-01 00:00:00')
          `).get(ch.id, ch.id, userId);
          unreadCount = r?.n ?? 0;
        } catch (_) {}
      }
      let displayName = ch.name;
      let workOrderStatus = null;
      if (ch.linked_type === 'work_order' && ch.linked_id) {
        const wo = db.prepare('SELECT number, title, status FROM work_orders WHERE id = ?').get(ch.linked_id);
        if (wo) {
          displayName = `OT ${wo.number} — ${(wo.title || '').slice(0, 30)}`;
          workOrderStatus = (wo.status || '').toLowerCase() || null;
        }
      } else if (ch.linked_type === 'equipment' && ch.linked_id) {
        const eq = db.prepare('SELECT code, name FROM equipment WHERE id = ?').get(ch.linked_id);
        displayName = eq ? `${eq.code || eq.name || ''} — ${(eq.name || '').slice(0, 25)}` : ch.name;
      }
      const teamNames = getChannelTeamNames(db, adminDb, ch.id);
      return {
        id: ch.id,
        name: ch.name,
        displayName,
        teamNames,
        workOrderStatus,
        type: ch.type,
        linkedType: ch.linked_type,
        linkedId: ch.linked_id,
        createdAt: ch.created_at,
        createdBy: ch.created_by,
        messageCount: ch.message_count || 0,
        lastMessageAt: ch.last_message_at,
        unreadCount: Math.max(0, unreadCount)
      };
    });
    res.json(withMeta);
  } catch (err) {
    if (err.message && err.message.includes('no such table')) {
      ensureChatTables(req.db);
      return res.json([]);
    }
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/** Créer un canal (team ou lié OT/équipement). */
router.post('/channels', requirePermission('chat', 'create'), [
  body('name').trim().notEmpty().withMessage('Nom requis'),
  body('type').optional().isIn(['team', 'work_order', 'equipment']),
  body('linkedType').optional().isIn(['work_order', 'equipment']),
  body('linkedId').optional().isInt()
], (req, res) => {
  const db = req.db;
  const userId = req.user?.id;
  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  if (userId == null) return res.status(401).json({ error: 'Utilisateur non identifié' });

  const { name, type = 'team', linkedType, linkedId } = req.body;
  try {
    if ((type === 'work_order' || linkedType === 'work_order') && linkedId) {
      const wo = db.prepare('SELECT id FROM work_orders WHERE id = ?').get(linkedId);
      if (!wo) return res.status(404).json({ error: 'OT introuvable' });
    }
    if ((type === 'equipment' || linkedType === 'equipment') && linkedId) {
      const eq = db.prepare('SELECT id FROM equipment WHERE id = ?').get(linkedId);
      if (!eq) return res.status(404).json({ error: 'Équipement introuvable' });
    }

    const existing = db.prepare(`
      SELECT id FROM chat_channels WHERE type = ? AND linked_type = ? AND linked_id = ?
    `).get(type, linkedType || null, linkedId ?? null);
    if (existing) return res.status(409).json({ error: 'Un canal existe déjà pour cette ressource.', channelId: existing.id });

    const run = db.prepare(`
      INSERT INTO chat_channels (name, type, linked_type, linked_id, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, type, linkedType || null, linkedId ?? null, userId);
    const channelId = Number(run.lastInsertRowid || 0);
    if (!channelId) return res.status(500).json({ error: 'Création du canal impossible' });

    db.prepare('INSERT OR IGNORE INTO chat_channel_members (channel_id, user_id) VALUES (?, ?)').run(channelId, userId);

    const row = db.prepare('SELECT id, name, type, linked_type, linked_id, created_at, created_by FROM chat_channels WHERE id = ?').get(channelId);
    if (!row) return res.status(500).json({ error: 'Canal créé mais lecture impossible' });

    res.status(201).json({
      id: row.id,
      name: row.name,
      type: row.type,
      linkedType: row.linked_type,
      linkedId: row.linked_id,
      createdAt: row.created_at,
      createdBy: row.created_by
    });
  } catch (err) {
    if (err.message && err.message.includes('no such table')) {
      ensureChatTables(req.db);
      try {
        const run = req.db.prepare(`
          INSERT INTO chat_channels (name, type, linked_type, linked_id, created_by)
          VALUES (?, ?, ?, ?, ?)
        `).run(name, type, linkedType || null, linkedId ?? null, userId);
        const channelId = Number(run.lastInsertRowid || 0);
        if (channelId) {
          req.db.prepare('INSERT OR IGNORE INTO chat_channel_members (channel_id, user_id) VALUES (?, ?)').run(channelId, userId);
          const row = req.db.prepare('SELECT id, name, type, linked_type, linked_id, created_at, created_by FROM chat_channels WHERE id = ?').get(channelId);
          if (row) {
            return res.status(201).json({
              id: row.id,
              name: row.name,
              type: row.type,
              linkedType: row.linked_type,
              linkedId: row.linked_id,
              createdAt: row.created_at,
              createdBy: row.created_by
            });
          }
        }
      } catch (e2) {
        console.error('[chat] POST /channels après création tables', e2.message);
      }
      return res.status(503).json({ error: 'Chat non disponible. Vérifiez que les migrations sont à jour.' });
    }
    console.error('[chat] POST /channels', err.message);
    res.status(500).json({ error: err.message || 'Erreur lors de la création du canal' });
  }
});

/** Canal par OT ou équipement. Pour un OT, crée le canal automatiquement s'il n'existe pas (techniciens assignés = membres). — Déclaré avant /channels/:id pour ne pas capturer "by-link" comme id. */
router.get('/channels/by-link', query('workOrderId').optional().isInt(), query('equipmentId').optional().isInt(), (req, res) => {
  const db = req.db;
  const userId = req.user.id;
  const workOrderId = req.query.workOrderId ? parseInt(req.query.workOrderId, 10) : null;
  const equipmentId = req.query.equipmentId ? parseInt(req.query.equipmentId, 10) : null;
  const CLOSED_WO_STATUSES = ['completed', 'cancelled'];
  try {
    if (workOrderId) {
      const wo = db.prepare('SELECT id, number, created_by, status FROM work_orders WHERE id = ?').get(workOrderId);
      if (!wo) return res.json({ channel: null, created: false });
      if (CLOSED_WO_STATUSES.includes((wo.status || '').toLowerCase())) {
        return res.json({ channel: null, created: false, workOrderClosed: true });
      }
      let ch = db.prepare(`
        SELECT c.id, c.name, c.type, c.linked_type, c.linked_id
        FROM chat_channels c WHERE c.linked_type = 'work_order' AND c.linked_id = ?
      `).get(workOrderId);
      let created = false;
      if (!ch) {
        const { ensureWorkOrderChannel, getWorkOrderMemberIds } = require('./chatChannelHelper');
        const memberIds = getWorkOrderMemberIds(db, workOrderId);
        ensureWorkOrderChannel(db, workOrderId, wo.number, wo.created_by, memberIds);
        ch = db.prepare(`
          SELECT c.id, c.name, c.type, c.linked_type, c.linked_id
          FROM chat_channels c WHERE c.linked_type = 'work_order' AND c.linked_id = ?
        `).get(workOrderId);
        created = !!ch;
      }
      if (ch) return res.json({ channel: ch, created });
      return res.json({ channel: null, created: false });
    }
    if (equipmentId) {
      const ch = db.prepare(`
        SELECT c.id, c.name, c.type, c.linked_type, c.linked_id
        FROM chat_channels c WHERE c.linked_type = 'equipment' AND c.linked_id = ?
      `).get(equipmentId);
      if (ch) return res.json({ channel: ch, created: false });
      return res.json({ channel: null, created: false });
    }
    res.status(400).json({ error: 'workOrderId ou equipmentId requis' });
  } catch (err) {
    if (err.message && err.message.includes('no such table')) {
      ensureChatTables(req.db);
      return res.json({ channel: null, created: false });
    }
    res.status(500).json({ error: err.message });
  }
});

/** Détail d'un canal. Admins et responsables ont accès à tous les canaux. */
router.get('/channels/:id', param('id').isInt(), (req, res) => {
  const db = req.db;
  ensureChatTables(db);
  const userId = req.user.id;
  const channelId = parseInt(req.params.id, 10);
  const adminDb = dbModule.getAdminDb && dbModule.getAdminDb();
  const roleName = (req.user.role_name || '').toLowerCase();
  const canAccessAll = roleName === 'administrateur' || roleName === 'responsable_maintenance';
  try {
    const ch = db.prepare(`
      SELECT c.*, (SELECT 1 FROM chat_channel_members m WHERE m.channel_id = c.id AND m.user_id = ?) AS is_member
      FROM chat_channels c WHERE c.id = ?
    `).get(userId, channelId);
    if (!ch) return res.status(404).json({ error: 'Canal introuvable' });
    if (ch.linked_type === 'work_order' && ch.linked_id) {
      const wo = db.prepare('SELECT status FROM work_orders WHERE id = ?').get(ch.linked_id);
      if (wo && ['completed', 'cancelled'].includes((wo.status || '').toLowerCase())) {
        return res.status(403).json({ error: 'Ce canal n\'est plus disponible (OT clôturé ou annulé).' });
      }
    }
    if (!canAccessAll && !ch.is_member && ch.type !== 'team') return res.status(403).json({ error: 'Accès refusé' });
    if (ch.type === 'team' && !ch.is_member && !canAccessAll) {
      db.prepare('INSERT OR IGNORE INTO chat_channel_members (channel_id, user_id) VALUES (?, ?)').run(channelId, userId);
    }
    if (canAccessAll && !ch.is_member) {
      db.prepare('INSERT OR IGNORE INTO chat_channel_members (channel_id, user_id) VALUES (?, ?)').run(channelId, userId);
    }
    let displayName = ch.name;
    if (ch.linked_type === 'work_order' && ch.linked_id) {
      const wo = db.prepare('SELECT number, title FROM work_orders WHERE id = ?').get(ch.linked_id);
      displayName = wo ? `OT ${wo.number} — ${wo.title || ''}` : ch.name;
    } else if (ch.linked_type === 'equipment' && ch.linked_id) {
      const eq = db.prepare('SELECT code, name FROM equipment WHERE id = ?').get(ch.linked_id);
      displayName = eq ? `${eq.code || ''} — ${eq.name || ''}` : ch.name;
    }
    const teamNames = getChannelTeamNames(db, adminDb, channelId);
    res.json({
      id: ch.id,
      name: ch.name,
      displayName,
      teamNames,
      type: ch.type,
      linkedType: ch.linked_type,
      linkedId: ch.linked_id,
      createdAt: ch.created_at,
      createdBy: ch.created_by
    });
  } catch (err) {
    if (err.message && err.message.includes('no such table')) {
      ensureChatTables(req.db);
      return res.status(404).json({ error: 'Canal introuvable' });
    }
    res.status(500).json({ error: err.message });
  }
});

/** Rejoindre un canal (équipe). */
router.post('/channels/:id/join', requirePermission('chat', 'create'), param('id').isInt(), (req, res) => {
  const db = req.db;
  const userId = req.user.id;
  const channelId = parseInt(req.params.id, 10);
  try {
    const ch = db.prepare('SELECT id, type FROM chat_channels WHERE id = ?').get(channelId);
    if (!ch) return res.status(404).json({ error: 'Canal introuvable' });
    db.prepare('INSERT OR IGNORE INTO chat_channel_members (channel_id, user_id) VALUES (?, ?)').run(channelId, userId);
    res.json({ joined: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Format datetime compatible SQLite (YYYY-MM-DD HH:MM:SS) pour comparaison avec created_at. */
function sqliteNow() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

/** Marquer un canal comme lu (met à jour last_read_at pour l'utilisateur). */
router.post('/channels/:id/read', param('id').isInt(), (req, res) => {
  const db = req.db;
  ensureChatTables(db);
  const userId = req.user.id;
  const channelId = parseInt(req.params.id, 10);
  const now = sqliteNow();
  try {
    const ch = db.prepare('SELECT id FROM chat_channels WHERE id = ?').get(channelId);
    if (!ch) return res.status(404).json({ error: 'Canal introuvable' });
    try {
      db.prepare('INSERT OR REPLACE INTO chat_channel_reads (channel_id, user_id, last_read_at) VALUES (?, ?, ?)').run(channelId, userId, now);
    } catch (e) {
      if (e.message && e.message.includes('no such table')) return res.json({ read: true });
      throw e;
    }
    if (typeof db._save === 'function') db._save();
    res.json({ read: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Messages d'un canal (paginated). */
router.get('/channels/:id/messages', param('id').isInt(), query('before').optional().isISO8601(), query('limit').optional().isInt({ min: 1, max: 100 }), (req, res) => {
  const db = req.db;
  ensureChatTables(db);
  const userId = req.user.id;
  const channelId = parseInt(req.params.id, 10);
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const before = req.query.before || null;
  try {
    const roleName = (req.user.role_name || '').toLowerCase();
    const canAccessAll = roleName === 'administrateur' || roleName === 'responsable_maintenance';
    const ch = db.prepare(`
      SELECT c.id, c.type, c.linked_type, c.linked_id, (SELECT 1 FROM chat_channel_members m WHERE m.channel_id = c.id AND m.user_id = ?) AS is_member
      FROM chat_channels c WHERE c.id = ?
    `).get(userId, channelId);
    if (!ch) return res.status(404).json({ error: 'Canal introuvable' });
    if (ch.linked_type === 'work_order' && ch.linked_id) {
      const wo = db.prepare('SELECT status FROM work_orders WHERE id = ?').get(ch.linked_id);
      if (wo && ['completed', 'cancelled'].includes((wo.status || '').toLowerCase())) {
        return res.status(403).json({ error: 'Ce canal n\'est plus disponible (OT clôturé ou annulé).' });
      }
    }
    if (!canAccessAll && !ch.is_member && ch.type !== 'team') return res.status(403).json({ error: 'Accès refusé' });
    if (!ch.is_member) {
      db.prepare('INSERT OR IGNORE INTO chat_channel_members (channel_id, user_id) VALUES (?, ?)').run(channelId, userId);
    }

    let sql = `SELECT m.id, m.channel_id, m.user_id, m.content, m.created_at, m.updated_at, m.message_type FROM chat_messages m WHERE m.channel_id = ?`;
    const params = [channelId];
    if (before) {
      sql += ' AND m.created_at < ?';
      params.push(before);
    }
    sql += ' ORDER BY m.created_at DESC LIMIT ?';
    params.push(limit + 1);

    let rows;
    try {
      rows = db.prepare(sql).all(...params);
    } catch (selectErr) {
      if (selectErr.message && selectErr.message.includes('no such column')) {
        const sqlFallback = `SELECT m.id, m.channel_id, m.user_id, m.content, m.created_at, m.updated_at FROM chat_messages m WHERE m.channel_id = ?${before ? ' AND m.created_at < ?' : ''} ORDER BY m.created_at DESC LIMIT ?`;
        const params2 = before ? [channelId, before, limit + 1] : [channelId, limit + 1];
        rows = db.prepare(sqlFallback).all(...params2);
      } else {
        throw selectErr;
      }
    }
    const hasMore = rows.length > limit;
    let adminDb = null;
    try {
      if (dbModule.getAdminDb) adminDb = dbModule.getAdminDb();
    } catch (e) {
      console.warn('[chat] getAdminDb', e.message);
    }
    const list = hasMore ? rows.slice(0, limit) : rows;
    const messages = list.reverse().map((r) => {
      try {
        return {
          id: r.id,
          channelId: r.channel_id,
          userId: r.user_id,
          authorName: getUserName(adminDb, r.user_id),
          content: r.content != null ? String(r.content) : '',
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          isOwn: Number(r.user_id) === Number(userId),
          messageType: (r.message_type != null && String(r.message_type).trim() !== '') ? String(r.message_type) : 'user'
        };
      } catch (e) {
        console.warn('[chat] message row', r && r.id, e.message);
        return {
          id: r.id,
          channelId: r.channel_id,
          userId: r.user_id,
          authorName: '—',
          content: r.content != null ? String(r.content) : '',
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          isOwn: false,
          messageType: 'user'
        };
      }
    });
    res.json({ messages, hasMore });
  } catch (err) {
    if (err.message && err.message.includes('no such table')) {
      ensureChatTables(req.db);
      return res.json({ messages: [], hasMore: false });
    }
    console.error('[chat] GET /channels/:id/messages', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** Envoyer un message. */
router.post('/channels/:id/messages', requirePermission('chat', 'create'), param('id').isInt(), [
  body('content').trim().notEmpty().withMessage('Message vide')
], (req, res) => {
  const db = req.db;
  const userId = req.user.id;
  const channelId = parseInt(req.params.id, 10);
  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const content = (req.body.content || '').trim().slice(0, 4000);
  try {
    const roleNameMsg = (req.user.role_name || '').toLowerCase();
    const canAccessAllMsg = roleNameMsg === 'administrateur' || roleNameMsg === 'responsable_maintenance';
    const ch = db.prepare(`
      SELECT c.id, c.type, c.linked_type, c.linked_id, (SELECT 1 FROM chat_channel_members m WHERE m.channel_id = c.id AND m.user_id = ?) AS is_member
      FROM chat_channels c WHERE c.id = ?
    `).get(userId, channelId);
    if (!ch) return res.status(404).json({ error: 'Canal introuvable' });
    if (ch.linked_type === 'work_order' && ch.linked_id) {
      const wo = db.prepare('SELECT status FROM work_orders WHERE id = ?').get(ch.linked_id);
      if (wo && ['completed', 'cancelled'].includes((wo.status || '').toLowerCase())) {
        return res.status(403).json({ error: 'Ce canal n\'est plus disponible (OT clôturé ou annulé).' });
      }
    }
    if (!ch.is_member) {
      if (canAccessAllMsg || ch.type === 'team') {
        db.prepare('INSERT OR IGNORE INTO chat_channel_members (channel_id, user_id) VALUES (?, ?)').run(channelId, userId);
      } else return res.status(403).json({ error: 'Rejoignez le canal pour envoyer des messages.' });
    }

    const run = db.prepare(`
      INSERT INTO chat_messages (channel_id, user_id, content) VALUES (?, ?, ?)
    `).run(channelId, userId, content);
    const msgId = run.lastInsertRowid;
    const row = db.prepare('SELECT id, channel_id, user_id, content, created_at, updated_at FROM chat_messages WHERE id = ?').get(msgId);
    const adminDb = dbModule.getAdminDb && dbModule.getAdminDb();
    const msgRow = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(msgId);
    res.status(201).json({
      id: row.id,
      channelId: row.channel_id,
      userId: row.user_id,
      authorName: getUserName(adminDb, row.user_id),
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isOwn: true,
      messageType: (msgRow && msgRow.message_type) || 'user'
    });
  } catch (err) {
    if (err.message && err.message.includes('no such table')) {
      ensureChatTables(req.db);
      return res.status(500).json({ error: 'Chat non disponible' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
