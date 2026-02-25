/**
 * API Sites et Lignes
 */
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, requirePermission, ROLES } = require('../middleware/auth');
const codification = require('../services/codification');

const router = express.Router();
router.use(authenticate);

function getDepartements(db) {
  try {
    return db.prepare('SELECT 1 FROM departements LIMIT 1').get() !== undefined;
  } catch {
    return false;
  }
}

router.get('/departements', requirePermission('sites', 'view'), (req, res) => {
  const db = req.db;
  if (!getDepartements(db)) return res.json([]);
  const { siteId } = req.query;
  let sql = 'SELECT d.*, s.name as site_name FROM departements d LEFT JOIN sites s ON d.site_id = s.id WHERE 1=1';
  const params = [];
  if (siteId) { sql += ' AND d.site_id = ?'; params.push(siteId); }
  sql += ' ORDER BY d.name';
  const rows = db.prepare(sql).all(...params);
  const byKey = new Map();
  rows.forEach((r) => {
    const key = `${r.site_id ?? ''}|${(r.code || '').trim()}`;
    if (!byKey.has(key)) byKey.set(key, r);
  });
  res.json([...byKey.values()]);
});

router.get('/departements/:id', requirePermission('sites', 'view'), param('id').isInt(), (req, res) => {
  const db = req.db;
  if (!getDepartements(db)) return res.status(404).json({ error: 'Département non trouvé' });
  const row = db.prepare('SELECT d.*, s.name as site_name FROM departements d LEFT JOIN sites s ON d.site_id = s.id WHERE d.id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Département non trouvé' });
  res.json(row);
});

router.post('/departements', requirePermission('sites', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('siteId').isInt(),
  body('name').notEmpty().trim()
], (req, res) => {
  const db = req.db;
  if (!getDepartements(db)) return res.status(400).json({ error: 'Table départements non disponible' });
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { siteId, code: codeProvided, name, description } = req.body;
  const siteExists = db.prepare('SELECT 1 FROM sites WHERE id = ?').get(siteId);
  if (!siteExists) return res.status(400).json({ error: 'Site inexistant' });
  const code = codification.generateCodeIfNeeded(db, 'departement', codeProvided, siteId);
  if (!code || !code.trim()) return res.status(400).json({ error: 'Code requis ou configurer la codification dans Paramétrage' });
  try {
    const r = db.prepare('INSERT INTO departements (site_id, code, name, description) VALUES (?, ?, ?, ?)').run(siteId, code.trim(), name, description || null);
    const row = db.prepare('SELECT d.*, s.name as site_name FROM departements d LEFT JOIN sites s ON d.site_id = s.id WHERE d.id = ?').get(r.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Code département déjà existant' });
    if (e.message?.includes('FOREIGN KEY')) return res.status(400).json({ error: 'Site inexistant' });
    throw e;
  }
});

router.put('/departements/:id', requirePermission('sites', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  if (!getDepartements(db)) return res.status(400).json({ error: 'Table départements non disponible' });
  const { siteId, code, name, description } = req.body;
  const id = req.params.id;
  const updates = []; const vals = [];
  if (siteId !== undefined) { updates.push('site_id = ?'); vals.push(siteId); }
  if (code !== undefined) { updates.push('code = ?'); vals.push(code); }
  if (name !== undefined) { updates.push('name = ?'); vals.push(name); }
  if (description !== undefined) { updates.push('description = ?'); vals.push(description); }
  if (updates.length === 0) return res.status(400).json({ error: 'Aucune donnée' });
  updates.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(id);
  db.prepare('UPDATE departements SET ' + updates.join(', ') + ' WHERE id = ?').run(...vals);
  res.json(db.prepare('SELECT d.*, s.name as site_name FROM departements d LEFT JOIN sites s ON d.site_id = s.id WHERE d.id = ?').get(id));
});

router.get('/sites', requirePermission('sites', 'view'), (req, res) => {
  const db = req.db;
  const rows = db.prepare('SELECT * FROM sites ORDER BY name').all();
  res.json(rows);
});

router.get('/sites/:id', requirePermission('sites', 'view'), param('id').isInt(), (req, res) => {
  const db = req.db;
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Site non trouvé' });
  res.json(row);
});

router.post('/sites', requirePermission('sites', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('name').notEmpty().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { code: codeProvided, name, address } = req.body;
  const code = codification.generateCodeIfNeeded(db, 'site', codeProvided);
  if (!code || !code.trim()) return res.status(400).json({ error: 'Code requis ou configurer la codification dans Paramétrage' });
  try {
    const r = db.prepare('INSERT INTO sites (code, name, address) VALUES (?, ?, ?)').run(code.trim(), name, address || null);
    const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Code site déjà existant' });
    throw e;
  }
});

router.put('/sites/:id', requirePermission('sites', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const { code, name, address, latitude, longitude } = req.body;
  const id = req.params.id;
  const updates = []; const vals = [];
  if (code !== undefined) { updates.push('code = ?'); vals.push(code); }
  if (name !== undefined) { updates.push('name = ?'); vals.push(name); }
  if (address !== undefined) { updates.push('address = ?'); vals.push(address); }
  if (latitude !== undefined) { updates.push('latitude = ?'); vals.push(latitude == null ? null : parseFloat(latitude)); }
  if (longitude !== undefined) { updates.push('longitude = ?'); vals.push(longitude == null ? null : parseFloat(longitude)); }
  if (updates.length === 0) return res.status(400).json({ error: 'Aucune donnée' });
  updates.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(id);
  try {
    db.prepare('UPDATE sites SET ' + updates.join(', ') + ' WHERE id = ?').run(...vals);
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      const u2 = updates.filter((u) => !u.includes('latitude') && !u.includes('longitude'));
      const idx = [updates.findIndex((u) => u.startsWith('latitude')), updates.findIndex((u) => u.startsWith('longitude'))].filter((i) => i >= 0).sort((a, b) => b - a);
      const v2 = [...vals];
      idx.forEach((i) => { v2.splice(i, 1); });
      v2[v2.length - 1] = id;
      db.prepare('UPDATE sites SET ' + u2.join(', ') + ' WHERE id = ?').run(...v2);
    } else throw e;
  }
  res.json(db.prepare('SELECT * FROM sites WHERE id = ?').get(id));
});

router.get('/lignes', requirePermission('sites', 'view'), (req, res) => {
  const db = req.db;
  const { siteId } = req.query;
  let sql = 'SELECT l.*, s.name as site_name FROM lignes l LEFT JOIN sites s ON l.site_id = s.id WHERE 1=1';
  const params = [];
  if (siteId) { sql += ' AND l.site_id = ?'; params.push(siteId); }
  sql += ' ORDER BY l.name';
  const rows = db.prepare(sql).all(...params);
  const byKey = new Map();
  rows.forEach((r) => {
    const key = `${r.site_id ?? ''}|${(r.code || '').trim()}`;
    if (!byKey.has(key)) byKey.set(key, r);
  });
  res.json([...byKey.values()]);
});

router.get('/lignes/:id', requirePermission('sites', 'view'), param('id').isInt(), (req, res) => {
  const db = req.db;
  const row = db.prepare('SELECT l.*, s.name as site_name FROM lignes l LEFT JOIN sites s ON l.site_id = s.id WHERE l.id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Ligne non trouvée' });
  res.json(row);
});

router.post('/lignes', requirePermission('sites', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('siteId').isInt(),
  body('name').notEmpty().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { siteId, code: codeProvided, name } = req.body;
  const siteExists = db.prepare('SELECT 1 FROM sites WHERE id = ?').get(siteId);
  if (!siteExists) return res.status(400).json({ error: 'Site inexistant' });
  const code = codification.generateCodeIfNeeded(db, 'ligne', codeProvided, siteId);
  if (!code || !code.trim()) return res.status(400).json({ error: 'Code requis ou configurer la codification dans Paramétrage' });
  try {
    const r = db.prepare('INSERT INTO lignes (site_id, code, name) VALUES (?, ?, ?)').run(siteId, code.trim(), name);
    const row = db.prepare('SELECT l.*, s.name as site_name FROM lignes l LEFT JOIN sites s ON l.site_id = s.id WHERE l.id = ?').get(r.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message?.includes('FOREIGN KEY')) return res.status(400).json({ error: 'Site inexistant' });
    throw e;
  }
});

router.put('/lignes/:id', requirePermission('sites', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const { siteId, code, name } = req.body;
  const id = req.params.id;
  const updates = []; const vals = [];
  if (siteId !== undefined) { updates.push('site_id = ?'); vals.push(siteId); }
  if (code !== undefined) { updates.push('code = ?'); vals.push(code); }
  if (name !== undefined) { updates.push('name = ?'); vals.push(name); }
  if (updates.length === 0) return res.status(400).json({ error: 'Aucune donnée' });
  updates.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(id);
  db.prepare('UPDATE lignes SET ' + updates.join(', ') + ' WHERE id = ?').run(...vals);
  res.json(db.prepare('SELECT l.*, s.name as site_name FROM lignes l LEFT JOIN sites s ON l.site_id = s.id WHERE l.id = ?').get(id));
});

module.exports = router;
