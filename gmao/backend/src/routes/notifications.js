/**
 * API Préférences de notifications (email/SMS) — utilisateur connecté
 * Users et préférences sont dans gmao.db → base admin.
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { EVENT_LABELS } = require('../services/notificationService');
const dbModule = require('../database/db');

const router = express.Router();
router.use(authenticate);

const EVENT_TYPES = ['work_order_created', 'work_order_assigned', 'work_order_closed', 'plan_overdue', 'stock_alert'];
const CHANNELS = ['email', 'sms'];

// GET /api/notifications/preferences — préférences + téléphone de l'utilisateur connecté
router.get('/preferences', (req, res) => {
  const adminDb = dbModule.getAdminDb();
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const user = adminDb.prepare('SELECT id, email, phone FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    let prefs = [];
    try {
      prefs = adminDb.prepare(`
        SELECT event_type, channel, enabled FROM notification_preferences WHERE user_id = ?
      `).all(userId);
    } catch (e) {
      if (!e.message || !e.message.includes('no such table')) throw e;
    }
    const byEvent = {};
    EVENT_TYPES.forEach((ev) => {
      byEvent[ev] = { email: true, sms: false };
      prefs.filter((p) => p.event_type === ev).forEach((p) => {
        byEvent[ev][p.channel] = !!p.enabled;
      });
    });
    res.json({
      email: user.email,
      phone: user.phone || '',
      events: EVENT_TYPES.map((ev) => ({ id: ev, label: EVENT_LABELS[ev] || ev })),
      preferences: byEvent
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/preferences — mettre à jour téléphone et préférences
router.put('/preferences', (req, res) => {
  const adminDb = dbModule.getAdminDb();
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  const { phone, preferences } = req.body;
  try {
    if (phone !== undefined) {
      adminDb.prepare('UPDATE users SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(phone ? String(phone).trim() : null, userId);
    }
    if (preferences && typeof preferences === 'object') {
      const upsert = adminDb.prepare(`
        INSERT INTO notification_preferences (user_id, event_type, channel, enabled) VALUES (?, ?, ?, ?)
      `);
      const update = adminDb.prepare(`
        UPDATE notification_preferences SET enabled = ? WHERE user_id = ? AND event_type = ? AND channel = ?
      `);
      for (const [eventType, channels] of Object.entries(preferences)) {
        if (!EVENT_TYPES.includes(eventType)) continue;
        for (const ch of CHANNELS) {
          const enabled = channels[ch] === true ? 1 : 0;
          const existing = adminDb.prepare('SELECT id FROM notification_preferences WHERE user_id = ? AND event_type = ? AND channel = ?').get(userId, eventType, ch);
          if (existing) {
            update.run(enabled, userId, eventType, ch);
          } else {
            upsert.run(userId, eventType, ch, enabled);
          }
        }
      }
    }
    adminDb._save();
    const user = adminDb.prepare('SELECT id, email, phone FROM users WHERE id = ?').get(userId);
    let prefs = adminDb.prepare('SELECT event_type, channel, enabled FROM notification_preferences WHERE user_id = ?').all(userId);
    const byEvent = {};
    EVENT_TYPES.forEach((ev) => {
      byEvent[ev] = { email: true, sms: false };
      prefs.filter((p) => p.event_type === ev).forEach((p) => {
        byEvent[ev][p.channel] = !!p.enabled;
      });
    });
    res.json({
      email: user.email,
      phone: user.phone || '',
      events: EVENT_TYPES.map((ev) => ({ id: ev, label: EVENT_LABELS[ev] || ev })),
      preferences: byEvent
    });
  } catch (err) {
    if (err.message && err.message.includes('no such table')) {
      return res.status(501).json({ error: 'Table notification_preferences absente. Exécutez les migrations.' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
