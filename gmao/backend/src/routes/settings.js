/**
 * API Paramétrage
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const codification = require('../services/codification');

const router = express.Router();
router.use(authenticate);

router.get('/hourly-rate', (req, res) => {
  try {
    const r = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('hourly_rate');
    res.json({ value: r?.value || '45' });
  } catch (e) {
    res.json({ value: '45' });
  }
});

router.post('/hourly-rate', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const { value } = req.body;
  const v = String(value || 45).replace(',', '.');
  try {
    db.prepare('INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
      .run('hourly_rate', v);
    res.json({ value: v });
  } catch (e) {
    try { db.exec('CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'); } catch (_) {}
    db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run('hourly_rate', v);
    res.json({ value: v });
  }
});

// ——— Codification (préfixe + longueur pour codes auto) ———
router.get('/codification', (req, res) => {
  try {
    res.json(codification.getAllConfig());
  } catch (e) {
    res.status(500).json({ error: e.message || 'Erreur codification' });
  }
});

router.put('/codification', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  try {
    const config = codification.setAllConfig(req.body);
    res.json(config);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Erreur enregistrement codification' });
  }
});

router.get('/codification/next/:entity', (req, res) => {
  const entity = req.params.entity;
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : undefined;
  if (!codification.ENTITY_CONFIG_KEYS[entity]) {
    return res.status(400).json({ error: 'Entité inconnue' });
  }
  try {
    const nextCode = codification.getNextCode(entity, siteId);
    res.json({ nextCode: nextCode || '' });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Erreur génération code' });
  }
});

// ——— Rôles (lecture seule : liste des rôles et nombre d'utilisateurs) ———
router.get('/roles', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT r.id, r.name, r.description, r.created_at,
             (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id AND u.is_active = 1) as userCount
      FROM roles r
      ORDER BY r.name
    `).all();
    res.json(rows.map(r => ({ ...r, permissionCount: 0 })));
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    res.status(500).json({ error: e.message || 'Erreur chargement rôles' });
  }
});

// ——— Sauvegarde base de données (réservé aux administrateurs) ———
router.get('/backup', authorize(ROLES.ADMIN), (req, res) => {
  try {
    db._save();
    const dbPath = db.getPath();
    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Fichier base de données introuvable' });
    }
    const name = `xmaint-backup-${new Date().toISOString().slice(0, 10)}.db`;
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.sendFile(path.resolve(dbPath));
  } catch (e) {
    res.status(500).json({ error: e.message || 'Erreur lors de la sauvegarde' });
  }
});

module.exports = router;
