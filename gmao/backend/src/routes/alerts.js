/**
 * Routes pour la gestion des alertes et notifications
 */

const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);

router.get('/', requirePermission('alerts', 'view'), (req, res) => {
  const db = req.db;
  try {
    try {
      db.prepare('SELECT 1 FROM alerts LIMIT 1').get();
    } catch (err) {
      if (err.message.includes('no such table')) {
        return res.json([]);
      }
      throw err;
    }

    const { is_read, alert_type, target_user_id } = req.query;
    const userId = req.user?.id;
    
    let query = `
      SELECT a.*,
             u.first_name || ' ' || u.last_name as read_by_name
      FROM alerts a
      LEFT JOIN users u ON a.read_by = u.id
      WHERE 1=1
    `;
    const params = [];

    // Par défaut, filtrer par utilisateur connecté si non admin
    if (target_user_id) {
      query += ' AND (a.target_user_id = ? OR a.target_user_id IS NULL)';
      params.push(target_user_id);
    } else if (userId && req.user?.role !== 'administrateur') {
      query += ' AND (a.target_user_id = ? OR a.target_user_id IS NULL)';
      params.push(userId);
    }

    if (is_read !== undefined) {
      query += ' AND a.is_read = ?';
      params.push(is_read === 'true' ? 1 : 0);
    }
    if (alert_type) {
      query += ' AND a.alert_type = ?';
      params.push(alert_type);
    }

    query += ' ORDER BY a.created_at DESC LIMIT 100';

    const rows = db.prepare(query).all(...params);
    // Une seule alerte par (entity_type, entity_id) pour éviter les doublons (ex. même OT notifié à plusieurs users)
    const seen = new Set();
    const alerts = rows.filter((a) => {
      const key = `${a.entity_type ?? ''}-${a.entity_id ?? ''}`;
      if (!key || key === '-') return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/unread-count', requirePermission('alerts', 'view'), (req, res) => {
  const db = req.db;
  try {
    const userId = req.user?.id;
    const rows = db.prepare(`
      SELECT entity_type, entity_id FROM alerts
      WHERE is_read = 0
        AND (target_user_id = ? OR target_user_id IS NULL)
        AND (expires_at IS NULL OR expires_at > datetime('now'))
    `).all(userId || null);
    const seen = new Set();
    let count = 0;
    rows.forEach((r) => {
      const key = `${r.entity_type ?? ''}-${r.entity_id ?? ''}`;
      if (!key || key === '-') count += 1;
      else if (!seen.has(key)) { seen.add(key); count += 1; }
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', requirePermission('alerts', 'create'), (req, res) => {
  const db = req.db;
  try {
    const {
      alert_type,
      severity,
      title,
      message,
      entity_type,
      entity_id,
      target_user_id,
      expires_at
    } = req.body;

    const result = db.prepare(`
      INSERT INTO alerts (
        alert_type, severity, title, message, entity_type, entity_id, target_user_id, expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      alert_type,
      severity || 'info',
      title,
      message,
      entity_type || null,
      entity_id || null,
      target_user_id || null,
      expires_at || null
    );

    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(alert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/read', requirePermission('alerts', 'update'), (req, res) => {
  const db = req.db;
  try {
    const userId = req.user?.id;
    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
    if (alert && alert.entity_type != null && alert.entity_id != null) {
      db.prepare(`
        UPDATE alerts
        SET is_read = 1, read_at = CURRENT_TIMESTAMP, read_by = ?
        WHERE (target_user_id = ? OR target_user_id IS NULL)
          AND entity_type = ? AND entity_id = ?
      `).run(userId, userId, alert.entity_type, alert.entity_id);
    } else {
      db.prepare(`
        UPDATE alerts SET is_read = 1, read_at = CURRENT_TIMESTAMP, read_by = ? WHERE id = ?
      `).run(userId, req.params.id);
    }
    const updated = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/read-all', requirePermission('alerts', 'update'), (req, res) => {
  const db = req.db;
  try {
    const userId = req.user?.id;
    db.prepare(`
      UPDATE alerts
      SET is_read = 1, read_at = CURRENT_TIMESTAMP, read_by = ?
      WHERE is_read = 0 AND (target_user_id = ? OR target_user_id IS NULL)
    `).run(userId, userId);

    res.json({ message: 'Toutes les alertes marquées comme lues' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', requirePermission('alerts', 'delete'), (req, res) => {
  const db = req.db;
  try {
    db.prepare('DELETE FROM alerts WHERE id = ?').run(req.params.id);
    res.json({ message: 'Alerte supprimée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
