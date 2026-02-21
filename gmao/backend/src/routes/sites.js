/**
 * API Sites et Lignes
 */
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../database/db');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const codification = require('../services/codification');

const router = express.Router();
router.use(authenticate);

// Départements (hiérarchie : Site → Département → Équipement)
function getDepartements() {
  try {
    return db.prepare('SELECT 1 FROM departements LIMIT 1').get() !== undefined;
  } catch {
    return false;
  }
}

router.get('/departements', (req, res) => {
  if (!getDepartements()) return res.json([]);
  const { siteId } = req.query;
  let sql = 'SELECT d.*, s.name as site_name FROM departements d LEFT JOIN sites s ON d.site_id = s.id WHERE 1=1';
  const params = [];
  if (siteId) { sql += ' AND d.site_id = ?'; params.push(siteId); }
  sql += ' ORDER BY d.name';
  res.json(db.prepare(sql).all(...params));
});

router.get('/departements/:id', param('id').isInt(), (req, res) => {
  if (!getDepartements()) return res.status(404).json({ error: 'Département non trouvé' });
  const row = db.prepare('SELECT d.*, s.name as site_name FROM departements d LEFT JOIN sites s ON d.site_id = s.id WHERE d.id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Département non trouvé' });
  res.json(row);
});

router.post('/departements', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('siteId').isInt(),
  body('name').notEmpty().trim()
], (req, res) => {
  if (!getDepartements()) return res.status(400).json({ error: 'Table départements non disponible' });
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { siteId, code: codeProvided, name, description } = req.body;
  const siteExists = db.prepare('SELECT 1 FROM sites WHERE id = ?').get(siteId);
  if (!siteExists) return res.status(400).json({ error: 'Site inexistant' });
  const code = codification.generateCodeIfNeeded('departement', codeProvided, siteId);
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

router.put('/departements/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  if (!getDepartements()) return res.status(400).json({ error: 'Table départements non disponible' });
  const { siteId, code, name, description } = req.body;
  const id = req.params.id;
  const updates = [];
  const vals = [];
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

// Sites
router.get('/sites', (req, res) => {
  const rows = db.prepare('SELECT * FROM sites ORDER BY name').all();
  res.json(rows);
});

router.get('/sites/:id', param('id').isInt(), (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Site non trouvé' });
  res.json(row);
});

router.post('/sites', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('name').notEmpty().trim()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { code: codeProvided, name, address } = req.body;
  const code = codification.generateCodeIfNeeded('site', codeProvided);
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

router.put('/sites/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const { code, name, address } = req.body;
  const id = req.params.id;
  const updates = [];
  const vals = [];
  if (code !== undefined) { updates.push('code = ?'); vals.push(code); }
  if (name !== undefined) { updates.push('name = ?'); vals.push(name); }
  if (address !== undefined) { updates.push('address = ?'); vals.push(address); }
  if (updates.length === 0) return res.status(400).json({ error: 'Aucune donnée' });
  updates.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(id);
  db.prepare('UPDATE sites SET ' + updates.join(', ') + ' WHERE id = ?').run(...vals);
  res.json(db.prepare('SELECT * FROM sites WHERE id = ?').get(id));
});

// Lignes
router.get('/lignes', (req, res) => {
  const { siteId } = req.query;
  let sql = 'SELECT l.*, s.name as site_name FROM lignes l LEFT JOIN sites s ON l.site_id = s.id WHERE 1=1';
  const params = [];
  if (siteId) { sql += ' AND l.site_id = ?'; params.push(siteId); }
  sql += ' ORDER BY l.name';
  res.json(db.prepare(sql).all(...params));
});

router.get('/lignes/:id', param('id').isInt(), (req, res) => {
  const row = db.prepare('SELECT l.*, s.name as site_name FROM lignes l LEFT JOIN sites s ON l.site_id = s.id WHERE l.id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Ligne non trouvée' });
  res.json(row);
});

router.post('/lignes', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('siteId').isInt(),
  body('name').notEmpty().trim()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { siteId, code: codeProvided, name } = req.body;
  const siteExists = db.prepare('SELECT 1 FROM sites WHERE id = ?').get(siteId);
  if (!siteExists) return res.status(400).json({ error: 'Site inexistant' });
  const code = codification.generateCodeIfNeeded('ligne', codeProvided, siteId);
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

router.put('/lignes/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const { siteId, code, name } = req.body;
  const id = req.params.id;
  const updates = [];
  const vals = [];
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
