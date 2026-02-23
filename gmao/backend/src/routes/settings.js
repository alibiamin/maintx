/**
 * API Paramétrage
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const codification = require('../services/codification');

const router = express.Router();
router.use(authenticate);

router.get('/hourly-rate', (req, res) => {
  const db = req.db;
  try {
    const r = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('hourly_rate');
    res.json({ value: r?.value || '45' });
  } catch (e) {
    res.json({ value: '45' });
  }
});

router.post('/hourly-rate', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const db = req.db;
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

// ——— Devise de l'application
function getCurrencyRow(db) {
  try {
    return db.prepare('SELECT value FROM app_settings WHERE key = ?').get('currency');
  } catch (e) {
    return null;
  }
}
router.get('/currency', (req, res) => {
  const db = req.db;
  const r = getCurrencyRow(db);
  res.json({ value: r?.value || '€' });
});
router.post('/currency', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const db = req.db;
  const { value } = req.body;
  const v = value != null ? String(value).trim() || '€' : '€';
  try {
    db.prepare('INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
      .run('currency', v);
  } catch (e) {
    try { db.exec('CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'); } catch (_) {}
    db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run('currency', v);
  }
  res.json({ value: v });
});

// ——— Codification (préfixe + longueur pour codes auto) ———
router.get('/codification', (req, res) => {
  const db = req.db;
  try {
    res.json(codification.getAllConfig(db));
  } catch (e) {
    res.status(500).json({ error: e.message || 'Erreur codification' });
  }
});

router.put('/codification', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const db = req.db;
  try {
    const config = codification.setAllConfig(db, req.body);
    res.json(config);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Erreur enregistrement codification' });
  }
});

router.get('/codification/next/:entity', (req, res) => {
  const db = req.db;
  const entity = req.params.entity;
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : undefined;
  if (!codification.ENTITY_CONFIG_KEYS[entity]) {
    return res.status(400).json({ error: 'Entité inconnue' });
  }
  try {
    const nextCode = codification.getNextCode(db, entity, siteId);
    res.json({ nextCode: nextCode || '' });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Erreur génération code' });
  }
});

// ——— Rôles (lecture seule : liste des rôles et nombre d'utilisateurs) ———
router.get('/roles', (req, res) => {
  const db = req.db;
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

// ——— Unités (référentiel pour les pièces stock, paramétrage) ———
router.get('/units', (req, res) => {
  const db = req.db;
  try {
    // Un seul enregistrement par nom (évite doublons si la migration a été exécutée plusieurs fois)
    const rows = db.prepare(`
      SELECT id, name, symbol, created_at FROM units
      WHERE id IN (SELECT MIN(id) FROM units GROUP BY name)
      ORDER BY name
    `).all();
    res.json(rows);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    res.status(500).json({ error: e.message || 'Erreur chargement unités' });
  }
});

router.post('/units', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const db = req.db;
  const { name, symbol } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nom requis' });
  try {
    const r = db.prepare('INSERT INTO units (name, symbol) VALUES (?, ?)').run(String(name).trim(), symbol ? String(symbol).trim() : null);
    const row = db.prepare('SELECT id, name, symbol, created_at FROM units WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Une unité avec ce nom existe déjà' });
    res.status(500).json({ error: e.message || 'Erreur création unité' });
  }
});

router.put('/units/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const db = req.db;
  const id = parseInt(req.params.id, 10);
  const { name, symbol } = req.body || {};
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID invalide' });
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nom requis' });
  try {
    db.prepare('UPDATE units SET name = ?, symbol = ? WHERE id = ?').run(String(name).trim(), symbol ? String(symbol).trim() : null, id);
    const row = db.prepare('SELECT id, name, symbol, created_at FROM units WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Unité non trouvée' });
    res.json(row);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Une unité avec ce nom existe déjà' });
    res.status(500).json({ error: e.message || 'Erreur mise à jour unité' });
  }
});

router.delete('/units/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const db = req.db;
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID invalide' });
  try {
    const used = db.prepare('SELECT COUNT(*) as c FROM spare_parts WHERE unit_id = ?').get(id);
    if (used && used.c > 0) return res.status(400).json({ error: 'Cette unité est utilisée par des pièces. Impossible de la supprimer.' });
    const r = db.prepare('DELETE FROM units WHERE id = ?').run(id);
    if (r.changes === 0) return res.status(404).json({ error: 'Unité non trouvée' });
    res.json({ message: 'Unité supprimée' });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Erreur suppression unité' });
  }
});

// ——— Sauvegarde base de données (réservé aux administrateurs) ———
router.get('/backup', authorize(ROLES.ADMIN), (req, res) => {
  const db = req.db;
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
