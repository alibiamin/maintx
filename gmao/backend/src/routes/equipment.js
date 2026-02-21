/**
 * API Gestion des équipements - CRUD, arborescence, fiches techniques
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../database/db');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const codification = require('../services/codification');

const router = express.Router();
router.use(authenticate);

function formatEquipment(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    categoryId: row.category_id,
    categoryName: row.category_name,
    ligneId: row.ligne_id,
    ligneName: row.ligne_name,
    parentId: row.parent_id,
    serialNumber: row.serial_number,
    manufacturer: row.manufacturer,
    model: row.model,
    installationDate: row.installation_date,
    location: row.location,
    criticite: row.criticite || 'B',
    technicalSpecs: row.technical_specs ? (typeof row.technical_specs === 'string' ? JSON.parse(row.technical_specs) : row.technical_specs) : null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * GET /api/equipment
 * Query: categoryId, ligneId, status, search, page (1-based), limit (default 20)
 * If page/limit provided: Response { data: [...], total: N }. Otherwise: array.
 */
router.get('/', (req, res) => {
  const { categoryId, ligneId, status, search, page, limit } = req.query;
  const usePagination = page !== undefined && page !== '';
  const limitNum = usePagination ? Math.min(parseInt(limit, 10) || 20, 100) : 1e6;
  const offset = usePagination ? ((parseInt(page, 10) || 1) - 1) * limitNum : 0;
  let where = ' WHERE 1=1';
  const params = [];
  if (categoryId) { where += ' AND e.category_id = ?'; params.push(categoryId); }
  if (ligneId) { where += ' AND e.ligne_id = ?'; params.push(ligneId); }
  if (status) { where += ' AND e.status = ?'; params.push(status); }
  if (search) { where += ' AND (e.code LIKE ? OR e.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  let total = 0;
  if (usePagination) {
    const countRow = db.prepare(`SELECT COUNT(*) as total FROM equipment e ${where}`).get(...params);
    total = countRow?.total ?? 0;
  }
  const sortBy = req.query.sortBy === 'name' ? 'e.name' : 'e.code';
  const order = req.query.order === 'asc' ? 'ASC' : 'DESC';
  const sql = `
    SELECT e.*, c.name as category_name, l.name as ligne_name
    FROM equipment e
    LEFT JOIN equipment_categories c ON e.category_id = c.id
    LEFT JOIN lignes l ON e.ligne_id = l.id
    ${where}
    ORDER BY ${sortBy} ${order} LIMIT ? OFFSET ?
  `;
  const rows = db.prepare(sql).all(...params, limitNum, offset);
  const byId = new Map();
  rows.forEach((r) => { if (!byId.has(r.id)) byId.set(r.id, r); });
  const data = [...byId.values()].map(formatEquipment);
  if (usePagination) res.json({ data, total });
  else res.json(data);
});

/**
 * GET /api/equipment/hierarchy-map
 * Hiérarchie : Site → Département → Machine → Section → Composants → Sous-composants
 * (Si pas de table departements : Site → Lignes → Équipements)
 */
router.get('/hierarchy-map', (req, res) => {
  const sites = db.prepare('SELECT id, code, name, address FROM sites ORDER BY code').all();
  let departements = [];
  try {
    departements = db.prepare('SELECT d.id, d.site_id, d.code, d.name FROM departements d ORDER BY d.site_id, d.code').all();
  } catch (_) {}
  const lignes = db.prepare('SELECT l.id, l.site_id, l.code, l.name FROM lignes l ORDER BY l.site_id, l.code').all();
  let equipRows = [];
  try {
    equipRows = db.prepare(`
      SELECT e.id, e.code, e.name, e.status, e.criticite, e.ligne_id, e.parent_id, e.category_id,
             e.department_id, e.equipment_type,
             c.name as category_name, l.name as ligne_name, l.site_id as ligne_site_id,
             d.name as department_name, d.site_id as department_site_id
      FROM equipment e
      LEFT JOIN equipment_categories c ON e.category_id = c.id
      LEFT JOIN lignes l ON e.ligne_id = l.id
      LEFT JOIN departements d ON e.department_id = d.id
      WHERE e.status != 'retired'
      ORDER BY e.department_id, e.ligne_id, e.parent_id, e.code
    `).all();
  } catch (_) {
    equipRows = db.prepare(`
      SELECT e.id, e.code, e.name, e.status, e.criticite, e.ligne_id, e.parent_id, e.category_id,
             c.name as category_name, l.name as ligne_name, l.site_id
      FROM equipment e
      LEFT JOIN equipment_categories c ON e.category_id = c.id
      LEFT JOIN lignes l ON e.ligne_id = l.id
      WHERE e.status != 'retired'
      ORDER BY e.ligne_id, e.parent_id, e.code
    `).all();
  }
  const woCounts = db.prepare(`
    SELECT equipment_id, status, priority, COUNT(*) as cnt
    FROM work_orders
    WHERE equipment_id IS NOT NULL AND status IN ('pending', 'in_progress')
    GROUP BY equipment_id, status, priority
  `).all();
  const woByEquip = {};
  woCounts.forEach(r => {
    if (!woByEquip[r.equipment_id]) woByEquip[r.equipment_id] = { pending: 0, inProgress: 0, critical: 0 };
    woByEquip[r.equipment_id].pending += r.status === 'pending' ? r.cnt : 0;
    woByEquip[r.equipment_id].inProgress += r.status === 'in_progress' ? r.cnt : 0;
    if (r.priority === 'critical') woByEquip[r.equipment_id].critical += r.cnt;
  });
  const equipments = equipRows.map(r => ({
    id: r.id,
    code: r.code,
    name: r.name,
    status: r.status,
    criticite: r.criticite || 'B',
    ligneId: r.ligne_id,
    ligneName: r.ligne_name,
    siteId: r.department_site_id != null ? r.department_site_id : r.site_id,
    parentId: r.parent_id,
    categoryName: r.category_name,
    departmentId: r.department_id || null,
    departmentName: r.department_name || null,
    equipmentType: r.equipment_type || 'machine',
    alertPending: woByEquip[r.id]?.pending || 0,
    alertInProgress: woByEquip[r.id]?.inProgress || 0,
    alertCritical: woByEquip[r.id]?.critical || 0,
    hasAlert: (woByEquip[r.id]?.pending || 0) + (woByEquip[r.id]?.inProgress || 0) > 0
  }));
  const byLigne = {};
  lignes.forEach(l => { byLigne[l.id] = { ...l, equipments: [] }; });
  const byDepartement = {};
  departements.forEach(d => { byDepartement[d.id] = { ...d, equipments: [] }; });
  const siteIdByLigne = {};
  lignes.forEach(l => { siteIdByLigne[l.id] = l.site_id; });
  const firstDepBySite = {};
  departements.forEach(d => {
    if (firstDepBySite[d.site_id] == null) firstDepBySite[d.site_id] = d.id;
  });
  equipments.forEach(e => {
    if (!e.parentId) {
      if (e.departmentId && byDepartement[e.departmentId]) {
        byDepartement[e.departmentId].equipments.push(e);
      } else if (e.ligneId && byLigne[e.ligneId]) {
        byLigne[e.ligneId].equipments.push(e);
        const siteId = siteIdByLigne[e.ligneId];
        const depId = siteId != null && firstDepBySite[siteId];
        if (depId && byDepartement[depId]) {
          byDepartement[depId].equipments.push(e);
          e.departmentId = depId;
          e.departmentName = byDepartement[depId].name;
        }
      }
    }
  });
  const bySite = {};
  sites.forEach(s => {
    const siteDepts = departements.filter(d => d.site_id === s.id);
    const seenCode = {};
    const uniqueDepts = siteDepts.filter(d => {
      const k = (d.code || d.id).toString();
      if (seenCode[k]) return false;
      seenCode[k] = true;
      return true;
    });
    bySite[s.id] = {
      ...s,
      departements: uniqueDepts.map(d => byDepartement[d.id]),
      lignes: lignes.filter(l => l.site_id === s.id).map(l => byLigne[l.id])
    };
  });
  const rootEquipments = equipments.filter(e => !e.ligneId && !e.departmentId && !e.parentId);
  res.json({
    sites: Object.values(bySite),
    departements,
    lignes: lignes.map(l => byLigne[l.id]),
    equipments,
    rootEquipments
  });
});

router.get('/tree', (req, res) => {
  const rows = db.prepare(`
    SELECT e.*, c.name as category_name, l.name as ligne_name
    FROM equipment e
    LEFT JOIN equipment_categories c ON e.category_id = c.id
    LEFT JOIN lignes l ON e.ligne_id = l.id
    ORDER BY e.category_id, e.parent_id, e.code
  `).all();
  const byParent = {};
  rows.forEach(r => {
    const key = r.parent_id || 'root';
    if (!byParent[key]) byParent[key] = [];
    byParent[key].push(formatEquipment(r));
  });
  function buildTree(parentId = 'root') {
    return (byParent[parentId] || []).map(node => ({
      ...node,
      children: buildTree(node.id)
    }));
  }
  res.json(buildTree());
});

router.get('/categories', (req, res) => {
  const cats = db.prepare('SELECT * FROM equipment_categories ORDER BY name').all();
  res.json(cats);
});

router.get('/:id/history', param('id').isInt(), (req, res) => {
  const workOrders = db.prepare(`
    SELECT wo.*, t.name as type_name, u.first_name || ' ' || u.last_name as assigned_name
    FROM work_orders wo
    LEFT JOIN work_order_types t ON wo.type_id = t.id
    LEFT JOIN users u ON wo.assigned_to = u.id
    WHERE wo.equipment_id = ?
    ORDER BY wo.created_at DESC
  `).all(req.params.id);
  res.json(workOrders);
});

router.get('/:id/documents', (req, res) => {
  const id = req.params.id;
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'ID équipement invalide' });
  try {
    const docs = db.prepare(`
      SELECT d.*, u.first_name, u.last_name FROM documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE d.entity_type = 'equipment' AND d.entity_id = ?
      ORDER BY d.created_at DESC
    `).all(id);
    res.json(docs);
  } catch (err) {
    if (err.message && err.message.includes('no such table')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/warranties', (req, res) => {
  const id = req.params.id;
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'ID équipement invalide' });
  try {
    const rows = db.prepare(`
      SELECT w.*, s.name as supplier_name FROM warranties w
      LEFT JOIN suppliers s ON w.supplier_id = s.id
      WHERE w.equipment_id = ?
      ORDER BY w.end_date DESC
    `).all(id);
    res.json(rows);
  } catch (err) {
    if (err.message && err.message.includes('no such table')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/equipment/:id/counters
 * Compteurs (heures, cycles, km) pour maintenance conditionnelle
 */
router.get('/:id/counters', param('id').isInt(), (req, res) => {
  const id = req.params.id;
  const eq = db.prepare('SELECT id FROM equipment WHERE id = ?').get(id);
  if (!eq) return res.status(404).json({ error: 'Équipement non trouvé' });
  try {
    const rows = db.prepare('SELECT id, equipment_id, counter_type, value, unit, updated_at FROM equipment_counters WHERE equipment_id = ?').all(id);
    res.json(rows.map(r => ({ id: r.id, equipmentId: r.equipment_id, counterType: r.counter_type, value: r.value, unit: r.unit || 'h', updatedAt: r.updated_at })));
  } catch (err) {
    if (err.message && err.message.includes('no such table')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/equipment/:id/counters
 * Mettre à jour ou créer un compteur (body: counterType, value, unit)
 */
router.put('/:id/counters', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), param('id').isInt(), [
  body('counterType').isIn(['hours', 'cycles', 'km', 'other']),
  body('value').custom((v) => {
    const n = parseFloat(v);
    if (Number.isNaN(n) || n < 0) throw new Error('Valeur invalide');
    return true;
  })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = req.params.id;
  const eq = db.prepare('SELECT id FROM equipment WHERE id = ?').get(id);
  if (!eq) return res.status(404).json({ error: 'Équipement non trouvé' });
  const { counterType, unit } = req.body;
  const value = parseFloat(req.body.value);
  if (Number.isNaN(value) || value < 0) return res.status(400).json({ error: 'Valeur invalide' });
  try {
    const existing = db.prepare('SELECT id FROM equipment_counters WHERE equipment_id = ? AND counter_type = ?').get(id, counterType);
    if (existing) {
      db.prepare('UPDATE equipment_counters SET value = ?, unit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(value, unit || 'h', existing.id);
    } else {
      db.prepare('INSERT INTO equipment_counters (equipment_id, counter_type, value, unit) VALUES (?, ?, ?, ?)').run(id, counterType, value, unit || 'h');
    }
    const row = db.prepare('SELECT * FROM equipment_counters WHERE equipment_id = ? AND counter_type = ?').get(id, counterType);
    res.json({ id: row.id, equipmentId: row.equipment_id, counterType: row.counter_type, value: row.value, unit: row.unit || 'h', updatedAt: row.updated_at });
  } catch (err) {
    if (err.message && err.message.includes('no such table')) return res.status(501).json({ error: 'Table equipment_counters non disponible' });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/equipment/:id/thresholds
 * Seuils IoT / prévisionnel pour un équipement
 */
router.get('/:id/thresholds', param('id').isInt(), (req, res) => {
  const id = req.params.id;
  const eq = db.prepare('SELECT id FROM equipment WHERE id = ?').get(id);
  if (!eq) return res.status(404).json({ error: 'Équipement non trouvé' });
  try {
    const rows = db.prepare('SELECT * FROM equipment_thresholds WHERE equipment_id = ?').all(id);
    res.json(rows.map((r) => ({
      id: r.id,
      equipmentId: r.equipment_id,
      metric: r.metric,
      thresholdValue: r.threshold_value,
      operator: r.operator,
      lastTriggeredAt: r.last_triggered_at,
      createWoOnBreach: !!r.create_wo_on_breach,
      createdAt: r.created_at
    })));
  } catch (err) {
    if (err.message && err.message.includes('no such table')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/equipment/:id/thresholds
 * Ajouter un seuil (body: metric, thresholdValue, operator, createWoOnBreach)
 */
router.post('/:id/thresholds', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), [
  body('metric').isIn(['temperature', 'vibrations', 'hours', 'cycles', 'pressure', 'custom']),
  body('thresholdValue').custom((v) => {
    const n = parseFloat(v);
    if (Number.isNaN(n)) throw new Error('Valeur seuil invalide');
    return true;
  }),
  body('operator').optional().isIn(['>', '<', '>=', '<=', '=', '!='])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = req.params.id;
  const eq = db.prepare('SELECT id FROM equipment WHERE id = ?').get(id);
  if (!eq) return res.status(404).json({ error: 'Équipement non trouvé' });
  const { metric, operator, createWoOnBreach } = req.body;
  const thresholdValue = parseFloat(req.body.thresholdValue);
  if (Number.isNaN(thresholdValue)) return res.status(400).json({ error: 'Valeur seuil invalide' });
  try {
    db.prepare(`
      INSERT INTO equipment_thresholds (equipment_id, metric, threshold_value, operator, create_wo_on_breach)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, metric, thresholdValue, operator || '>=', createWoOnBreach ? 1 : 0);
    const row = db.prepare('SELECT * FROM equipment_thresholds WHERE equipment_id = ? AND metric = ?').get(id, metric);
    res.status(201).json({
      id: row.id,
      equipmentId: row.equipment_id,
      metric: row.metric,
      thresholdValue: row.threshold_value,
      operator: row.operator,
      lastTriggeredAt: row.last_triggered_at,
      createWoOnBreach: !!row.create_wo_on_breach,
      createdAt: row.created_at
    });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Un seuil pour ce métrique existe déjà' });
    if (err.message && err.message.includes('no such table')) return res.status(501).json({ error: 'Table equipment_thresholds non disponible' });
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/equipment/:id/thresholds/:tid
 */
router.delete('/:id/thresholds/:tid', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), param('tid').isInt(), (req, res) => {
  const result = db.prepare('DELETE FROM equipment_thresholds WHERE id = ? AND equipment_id = ?').run(req.params.tid, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Seuil non trouvé' });
  res.status(204).send();
});

router.get('/:id', param('id').isInt(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const row = db.prepare(`
    SELECT e.*, c.name as category_name, l.name as ligne_name
    FROM equipment e
    LEFT JOIN equipment_categories c ON e.category_id = c.id
    LEFT JOIN lignes l ON e.ligne_id = l.id
    WHERE e.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Equipement non trouve' });
  res.json(formatEquipment(row));
});

router.post('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('name').notEmpty().trim()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { code: codeProvided, name, description, categoryId, parentId, serialNumber, manufacturer, model, installationDate, location, technicalSpecs, status } = req.body;
  const code = codification.generateCodeIfNeeded('machine', codeProvided);
  if (!code || !code.trim()) return res.status(400).json({ error: 'Code requis ou configurer la codification dans Paramétrage' });
  const departmentId = req.body.departmentId != null ? req.body.departmentId : null;
  const equipmentType = req.body.equipmentType || 'machine';
  try {
    const result = db.prepare(`
      INSERT INTO equipment (code, name, description, category_id, ligne_id, parent_id, serial_number, manufacturer, model, installation_date, location, technical_specs, criticite, status, department_id, equipment_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code.trim(), name, description || null, categoryId || null, req.body.ligneId || null, parentId || null,
      serialNumber || null, manufacturer || null, model || null,
      installationDate || null, location || null,
      technicalSpecs ? JSON.stringify(technicalSpecs) : null,
      req.body.criticite || 'B',
      status || 'operational',
      departmentId,
      equipmentType
    );
    const newRow = db.prepare('SELECT e.*, c.name as category_name, l.name as ligne_name FROM equipment e LEFT JOIN equipment_categories c ON e.category_id = c.id LEFT JOIN lignes l ON e.ligne_id = l.id WHERE e.id = ?').get(result.lastInsertRowid);
    res.status(201).json(formatEquipment(newRow));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Code equipement deja existant' });
    throw e;
  }
});

router.put('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT id FROM equipment WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Equipement non trouve' });
  const fields = ['code', 'name', 'description', 'category_id', 'ligne_id', 'parent_id', 'serial_number', 'manufacturer', 'model', 'installation_date', 'location', 'criticite', 'status'];
  const mapping = { categoryId: 'category_id', ligneId: 'ligne_id', parentId: 'parent_id', serialNumber: 'serial_number', installationDate: 'installation_date' };
  const updates = [];
  const values = [];
  for (const [key, val] of Object.entries(req.body)) {
    const col = mapping[key] || key;
    if (fields.includes(col) && val !== undefined) {
      if (col === 'technical_specs') {
        updates.push('technical_specs = ?');
        values.push(typeof val === 'object' ? JSON.stringify(val) : val);
      } else {
        updates.push(col + ' = ?');
        values.push(val);
      }
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'Aucune donnee a mettre a jour' });
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  db.prepare('UPDATE equipment SET ' + updates.join(', ') + ' WHERE id = ?').run(...values);
  const row = db.prepare('SELECT e.*, c.name as category_name, l.name as ligne_name FROM equipment e LEFT JOIN equipment_categories c ON e.category_id = c.id LEFT JOIN lignes l ON e.ligne_id = l.id WHERE e.id = ?').get(id);
  res.json(formatEquipment(row));
});

router.delete('/:id', authorize(ROLES.ADMIN), param('id').isInt(), (req, res) => {
  const id = req.params.id;
  const hasRefs = db.prepare('SELECT 1 FROM work_orders WHERE equipment_id = ? LIMIT 1').get(id);
  if (hasRefs) return res.status(400).json({ error: 'Impossible de supprimer : équipement référencé par des ordres de travail' });
  const hasPlans = db.prepare('SELECT 1 FROM maintenance_plans WHERE equipment_id = ? LIMIT 1').get(id);
  if (hasPlans) return res.status(400).json({ error: 'Impossible de supprimer : équipement référencé par des plans de maintenance' });
  try {
    db.prepare('UPDATE equipment SET parent_id = NULL WHERE parent_id = ?').run(id);
    const result = db.prepare('DELETE FROM equipment WHERE id = ?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Équipement non trouvé' });
    res.status(204).send();
  } catch (e) {
    if (e.message && e.message.includes('FOREIGN KEY')) {
      return res.status(400).json({ error: 'Impossible de supprimer : équipement encore référencé (contrats, pièces, documents, etc.)' });
    }
    throw e;
  }
});

module.exports = router;
