/**
 * API Paramétrage
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticate, authorize, requirePermission, ROLES } = require('../middleware/auth');
const codification = require('../services/codification');
const { getIndicatorTargets } = require('../services/indicatorTargets');

const router = express.Router();
router.use(authenticate);
router.use(requirePermission('settings', 'view'));

router.get('/hourly-rate', (req, res) => {
  const db = req.db;
  try {
    const r = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('hourly_rate');
    res.json({ value: r?.value || '45' });
  } catch (e) {
    res.json({ value: '45' });
  }
});

router.post('/hourly-rate', requirePermission('settings', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
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
router.post('/currency', requirePermission('settings', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
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

router.put('/codification', requirePermission('settings', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
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

// ——— Objectifs des indicateurs (targets) ———
router.get('/indicator-targets', (req, res) => {
  const db = req.db;
  try {
    const list = getIndicatorTargets(db);
    res.json(list);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    res.status(500).json({ error: e.message || 'Erreur chargement objectifs' });
  }
});

router.put('/indicator-targets', requirePermission('settings', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const db = req.db;
  const body = Array.isArray(req.body) ? req.body : (req.body?.targets ? req.body.targets : []);
  if (!body.length) return res.status(400).json({ error: 'Tableau d\'objectifs requis' });
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS indicator_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        label TEXT NOT NULL,
        target_value REAL NOT NULL,
        direction TEXT NOT NULL CHECK(direction IN ('min', 'max')),
        unit TEXT DEFAULT '',
        ref_label TEXT DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (_) {}
  const updateStmt = db.prepare(`
    UPDATE indicator_targets SET label = ?, target_value = ?, direction = ?, unit = ?, ref_label = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?
  `);
  const insertStmt = db.prepare(`
    INSERT INTO indicator_targets (key, label, target_value, direction, unit, ref_label, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  try {
    for (let i = 0; i < body.length; i++) {
      const r = body[i];
      const key = r.key || r.id;
      const label = r.label != null ? String(r.label) : key;
      const target_value = Number(r.target_value);
      const direction = r.direction === 'max' ? 'max' : 'min';
      const unit = r.unit != null ? String(r.unit) : '';
      const ref_label = r.ref_label != null ? String(r.ref_label) : '';
      const sort_order = parseInt(r.sort_order, 10) || i;
      if (!key) continue;
      const upd = updateStmt.run(label, target_value, direction, unit, ref_label, sort_order, key);
      if (upd.changes === 0) insertStmt.run(key, label, target_value, direction, unit, ref_label, sort_order);
    }
    const list = getIndicatorTargets(db);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Erreur enregistrement objectifs' });
  }
});

// ——— Rôles (lecture seule : liste des rôles et nombre d'utilisateurs) ———
router.get('/roles', requirePermission('settings', 'view'), (req, res) => {
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

router.post('/units', requirePermission('settings', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
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

router.put('/units/:id', requirePermission('settings', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
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

router.delete('/units/:id', requirePermission('settings', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
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

// ——— Indicateurs KPI configurables (paramétrage) ———
const KPI_SOURCES = [
  { key: 'availabilityRate', label: 'Disponibilité équipements', format: 'percent', icon: 'Speed' },
  { key: 'preventiveComplianceRate', label: 'Respect plans préventifs', format: 'percent', icon: 'Schedule' },
  { key: 'totalCostPeriod', label: 'Coût maintenance (période)', format: 'currency', icon: 'Euro' },
  { key: 'mttr', label: 'MTTR (temps moyen réparation)', format: 'hours', icon: 'Build' },
  { key: 'mtbf', label: 'MTBF (entre pannes)', format: 'days', icon: 'TrendingUp' },
  { key: 'slaBreached', label: 'OT en retard (SLA)', format: 'number', icon: 'Warning' },
  { key: 'oee', label: 'OEE (simplifié)', format: 'percent', icon: 'Speed' }
];

router.get('/kpi-definitions/sources', (req, res) => {
  res.json(KPI_SOURCES);
});

router.get('/kpi-definitions', (req, res) => {
  const db = req.db;
  try {
    const rows = db.prepare(`
      SELECT id, name, source_key, order_index, color, icon, is_visible, created_at
      FROM kpi_definitions ORDER BY order_index ASC, id ASC
    `).all();
    res.json(rows);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    res.status(500).json({ error: e.message || 'Erreur chargement indicateurs KPI' });
  }
});

router.post('/kpi-definitions', requirePermission('settings', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const db = req.db;
  const { name, source_key, order_index, color, icon, is_visible } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nom requis' });
  if (!source_key || !String(source_key).trim()) return res.status(400).json({ error: 'Source (indicateur) requise' });
  const validSource = KPI_SOURCES.some(s => s.key === source_key);
  if (!validSource) return res.status(400).json({ error: 'Source non reconnue' });
  try {
    const maxOrder = db.prepare('SELECT COALESCE(MAX(order_index), -1) + 1 as next FROM kpi_definitions').get();
    const order = order_index != null ? parseInt(order_index, 10) : (maxOrder?.next ?? 0);
    db.prepare(`
      INSERT INTO kpi_definitions (name, source_key, order_index, color, icon, is_visible)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      String(name).trim(),
      String(source_key).trim(),
      isNaN(order) ? 0 : order,
      color && ['primary', 'success', 'warning', 'error', 'info'].includes(color) ? color : 'primary',
      icon ? String(icon).trim() : null,
      is_visible === false || is_visible === 0 ? 0 : 1
    );
    const row = db.prepare('SELECT id, name, source_key, order_index, color, icon, is_visible, created_at FROM kpi_definitions ORDER BY id DESC LIMIT 1').get();
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(500).json({ error: 'Table kpi_definitions absente. Exécutez les migrations.' });
    res.status(500).json({ error: e.message || 'Erreur création indicateur' });
  }
});

router.put('/kpi-definitions/:id', requirePermission('settings', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const db = req.db;
  const id = parseInt(req.params.id, 10);
  const { name, source_key, order_index, color, icon, is_visible } = req.body || {};
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID invalide' });
  try {
    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(String(name).trim()); }
    if (source_key !== undefined) {
      const validSource = KPI_SOURCES.some(s => s.key === source_key);
      if (!validSource) return res.status(400).json({ error: 'Source non reconnue' });
      updates.push('source_key = ?'); values.push(String(source_key).trim());
    }
    if (order_index !== undefined) { updates.push('order_index = ?'); values.push(parseInt(order_index, 10) || 0); }
    if (color !== undefined) { updates.push('color = ?'); values.push(['primary', 'success', 'warning', 'error', 'info'].includes(color) ? color : 'primary'); }
    if (icon !== undefined) { updates.push('icon = ?'); values.push(icon ? String(icon).trim() : null); }
    if (is_visible !== undefined) { updates.push('is_visible = ?'); values.push(is_visible === false || is_visible === 0 ? 0 : 1); }
    if (updates.length === 0) return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
    values.push(id);
    db.prepare('UPDATE kpi_definitions SET ' + updates.join(', ') + ' WHERE id = ?').run(...values);
    const row = db.prepare('SELECT id, name, source_key, order_index, color, icon, is_visible, created_at FROM kpi_definitions WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Indicateur non trouvé' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Erreur mise à jour indicateur' });
  }
});

router.put('/kpi-definitions/reorder', requirePermission('settings', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const db = req.db;
  const order = req.body?.order; // [ { id, order_index }, ... ]
  if (!Array.isArray(order) || order.length === 0) return res.status(400).json({ error: 'Tableau order requis' });
  try {
    const stmt = db.prepare('UPDATE kpi_definitions SET order_index = ? WHERE id = ?');
    for (const item of order) {
      const id = parseInt(item.id, 10);
      const order_index = parseInt(item.order_index, 10);
      if (!id || isNaN(id)) continue;
      stmt.run(isNaN(order_index) ? 0 : order_index, id);
    }
    res.json({ message: 'Ordre enregistré' });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Erreur mise à jour ordre' });
  }
});

router.delete('/kpi-definitions/:id', requirePermission('settings', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const db = req.db;
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'ID invalide' });
  try {
    const r = db.prepare('DELETE FROM kpi_definitions WHERE id = ?').run(id);
    if (r.changes === 0) return res.status(404).json({ error: 'Indicateur non trouvé' });
    res.json({ message: 'Indicateur supprimé' });
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(404).json({ error: 'Indicateur non trouvé' });
    res.status(500).json({ error: e.message || 'Erreur suppression' });
  }
});

// ——— Templates email ———
router.get('/email-templates', (req, res) => {
  const db = req.db;
  try {
    const rows = db.prepare('SELECT * FROM email_templates ORDER BY code').all();
    res.json(rows);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});
router.get('/email-templates/:id', (req, res) => {
  const db = req.db;
  try {
    const row = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Template non trouvé' });
    res.json(row);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(404).json({ error: 'Template non trouvé' });
    throw e;
  }
});
router.post('/email-templates', requirePermission('settings', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const db = req.db;
  const { code, name, subjectTemplate, bodyTemplate, description } = req.body || {};
  if (!code || !name) return res.status(400).json({ error: 'code et name requis' });
  try {
    db.prepare(`
      INSERT INTO email_templates (code, name, subject_template, body_template, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(code.trim(), name.trim(), subjectTemplate || null, bodyTemplate || null, description || null);
    const row = db.prepare('SELECT * FROM email_templates WHERE code = ?').get(code.trim());
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Code déjà existant' });
    if (e.message && e.message.includes('no such table')) return res.status(501).json({ error: 'Table email_templates non disponible' });
    throw e;
  }
});
router.put('/email-templates/:id', requirePermission('settings', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Template non trouvé' });
  const { code, name, subjectTemplate, bodyTemplate, description } = req.body || {};
  db.prepare(`
    UPDATE email_templates SET code = ?, name = ?, subject_template = ?, body_template = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(code ?? existing.code, name ?? existing.name, subjectTemplate !== undefined ? subjectTemplate : existing.subject_template, bodyTemplate !== undefined ? bodyTemplate : existing.body_template, description !== undefined ? description : existing.description, id);
  res.json(db.prepare('SELECT * FROM email_templates WHERE id = ?').get(id));
});
router.delete('/email-templates/:id', requirePermission('settings', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const db = req.db;
  const r = db.prepare('DELETE FROM email_templates WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Template non trouvé' });
  res.status(204).send();
});

// ——— Seuil alerte dépassement budget (%) ———
router.get('/budget-alert-threshold', (req, res) => {
  const db = req.db;
  try {
    const r = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('budget_alert_threshold_percent');
    res.json({ value: r?.value != null ? parseFloat(r.value) : 90 });
  } catch (e) {
    res.json({ value: 90 });
  }
});
router.post('/budget-alert-threshold', requirePermission('settings', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const db = req.db;
  const v = Math.min(100, Math.max(0, parseFloat(req.body?.value) || 90));
  try {
    db.prepare('INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run('budget_alert_threshold_percent', String(v));
  } catch (e) {
    try { db.exec('CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'); } catch (_) {}
    db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run('budget_alert_threshold_percent', String(v));
  }
  res.json({ value: v });
});

// ——— Seuil approbation OT (montant en €) ———
router.get('/approval-threshold-amount', (req, res) => {
  const db = req.db;
  try {
    const r = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('approval_threshold_amount');
    res.json({ value: r?.value != null ? parseFloat(r.value) : 0 });
  } catch (e) {
    res.json({ value: 0 });
  }
});
router.post('/approval-threshold-amount', requirePermission('settings', 'update'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  const db = req.db;
  const v = Math.max(0, parseFloat(req.body?.value) || 0);
  try {
    db.prepare('INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run('approval_threshold_amount', String(v));
  } catch (e) {
    try { db.exec('CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'); } catch (_) {}
    db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run('approval_threshold_amount', String(v));
  }
  res.json({ value: v });
});

// ——— Sauvegarde base de données (réservé aux administrateurs) ———
router.get('/backup', requirePermission('settings', 'update'), authorize(ROLES.ADMIN), (req, res) => {
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
