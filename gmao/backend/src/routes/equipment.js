/**
 * API Gestion des équipements - CRUD, arborescence, fiches techniques
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate, requirePermission, authorize, ROLES } = require('../middleware/auth');
const codification = require('../services/codification');
const auditService = require('../services/auditService');

const router = express.Router();
router.use(authenticate);

/** Retourne true si le paramètre :id est invalide (réponse 400 déjà envoyée) */
function validateIdParam(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
}

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
    departmentId: row.department_id != null ? row.department_id : null,
    equipmentType: row.equipment_type || 'machine',
    serialNumber: row.serial_number,
    manufacturer: row.manufacturer,
    model: row.model,
    installationDate: row.installation_date,
    location: row.location,
    criticite: row.criticite || 'B',
    technicalSpecs: row.technical_specs ? (typeof row.technical_specs === 'string' ? JSON.parse(row.technical_specs) : row.technical_specs) : null,
    status: row.status,
    acquisitionValue: row.acquisition_value,
    depreciationYears: row.depreciation_years,
    residualValue: row.residual_value,
    depreciationStartDate: row.depreciation_start_date,
    targetCostPerOperatingHour: row.target_cost_per_operating_hour != null ? row.target_cost_per_operating_hour : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * GET /api/equipment
 * Query: categoryId, ligneId, status, search, page (1-based), limit (default 20)
 * If page/limit provided: Response { data: [...], total: N }. Otherwise: array.
 */
router.get('/', requirePermission('equipment', 'view'), (req, res) => {
  const db = req.db;
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
router.get('/hierarchy-map', requirePermission('equipment', 'view'), (req, res) => {
  const db = req.db;
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
  let woList = [];
  try {
    woList = db.prepare(`
      SELECT id, number, title, status, priority, equipment_id
      FROM work_orders
      WHERE equipment_id IS NOT NULL AND status IN ('pending', 'in_progress')
      ORDER BY priority = 'critical' DESC, status = 'in_progress' DESC, id
    `).all();
  } catch (_) {}
  const woByEquip = {};
  woCounts.forEach(r => {
    if (!woByEquip[r.equipment_id]) woByEquip[r.equipment_id] = { pending: 0, inProgress: 0, critical: 0, list: [] };
    woByEquip[r.equipment_id].pending += r.status === 'pending' ? r.cnt : 0;
    woByEquip[r.equipment_id].inProgress += r.status === 'in_progress' ? r.cnt : 0;
    if (r.priority === 'critical') woByEquip[r.equipment_id].critical += r.cnt;
  });
  woList.forEach(wo => {
    if (!wo.equipment_id) return;
    if (!woByEquip[wo.equipment_id]) woByEquip[wo.equipment_id] = { pending: 0, inProgress: 0, critical: 0, list: [] };
    if (!woByEquip[wo.equipment_id].list) woByEquip[wo.equipment_id].list = [];
    woByEquip[wo.equipment_id].list.push({
      id: wo.id,
      number: wo.number,
      title: wo.title,
      status: wo.status,
      priority: wo.priority
    });
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
    hasAlert: (woByEquip[r.id]?.pending || 0) + (woByEquip[r.id]?.inProgress || 0) > 0,
    workOrdersInProgress: woByEquip[r.id]?.list || []
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

router.get('/tree', requirePermission('equipment', 'view'), (req, res) => {
  const db = req.db;
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

router.get('/categories', requirePermission('equipment', 'view'), (req, res) => {
  const db = req.db;
  const rows = db.prepare(`
    SELECT c.id, c.name, c.description, c.parent_id,
           p.name as parent_name,
           (SELECT COUNT(*) FROM equipment e WHERE e.category_id = c.id) as equipment_count
    FROM equipment_categories c
    LEFT JOIN equipment_categories p ON c.parent_id = p.id
    ORDER BY (p.name IS NULL) DESC, p.name, c.name, c.id
  `).all();
  const byName = new Map();
  for (const r of rows) {
    const name = (r.name != null ? String(r.name).trim() : '') || null;
    if (!name) continue;
    const existing = byName.get(name);
    const count = r.equipment_count ?? 0;
    if (!existing) {
      byName.set(name, {
        id: r.id,
        name: r.name,
        description: r.description || null,
        parentId: r.parent_id || null,
        parentName: r.parent_name || null,
        equipmentCount: count
      });
    } else {
      existing.equipmentCount += count;
    }
  }
  const list = [...byName.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  res.json(list);
});

router.post('/categories', requirePermission('equipment', 'create'), [
  body('name').notEmpty().trim(),
  body('description').optional().trim(),
  body('parentId').optional().custom((val) => val === null || val === undefined || val === '' || Number.isInteger(Number(val)))
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const name = (req.body.name != null && typeof req.body.name === 'string') ? req.body.name.trim() : '';
  const description = req.body.description != null && req.body.description !== '' ? String(req.body.description).trim() : null;
  const parentId = (req.body.parentId === '' || req.body.parentId === null || req.body.parentId === undefined) ? null : parseInt(req.body.parentId, 10);
  if (!name) return res.status(400).json({ error: 'Le nom est requis' });
  try {
    const result = db.prepare(`
      INSERT INTO equipment_categories (name, description, parent_id) VALUES (?, ?, ?)
    `).run(name, description, parentId);
    if (db._save) db._save();
    const row = db.prepare(`
      SELECT c.id, c.name, c.description, c.parent_id, p.name as parent_name,
             (SELECT COUNT(*) FROM equipment e WHERE e.category_id = c.id) as equipment_count
      FROM equipment_categories c
      LEFT JOIN equipment_categories p ON c.parent_id = p.id
      WHERE c.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json({
      id: row.id,
      name: row.name,
      description: row.description || null,
      parentId: row.parent_id || null,
      parentName: row.parent_name || null,
      equipmentCount: row.equipment_count ?? 0
    });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Une catégorie avec ce nom existe déjà' });
    throw e;
  }
});

router.put('/categories/:id', requirePermission('equipment', 'update'), [
  param('id').isInt(),
  body('name').notEmpty().trim(),
  body('description').optional().trim(),
  body('parentId').optional().custom((val) => val === null || val === undefined || val === '' || Number.isInteger(Number(val)))
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = parseInt(req.params.id);
  const name = (req.body.name != null && typeof req.body.name === 'string') ? req.body.name.trim() : '';
  const description = req.body.description != null && req.body.description !== '' ? String(req.body.description).trim() : null;
  let parentId = req.body.parentId;
  const newParentId = (parentId === '' || parentId === null || parentId === undefined) ? null : parseInt(parentId, 10);
  if (name === '') return res.status(400).json({ error: 'Le nom est requis' });
  const existing = db.prepare('SELECT id FROM equipment_categories WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Catégorie non trouvée' });
  if (newParentId !== null && newParentId === id) return res.status(400).json({ error: 'Une catégorie ne peut pas être sa propre parente' });
  try {
    db.prepare(`
      UPDATE equipment_categories SET name = ?, description = ?, parent_id = ? WHERE id = ?
    `).run(name, description, newParentId, id);
    if (db._save) db._save();
    const row = db.prepare(`
      SELECT c.id, c.name, c.description, c.parent_id, p.name as parent_name,
             (SELECT COUNT(*) FROM equipment e WHERE e.category_id = c.id) as equipment_count
      FROM equipment_categories c
      LEFT JOIN equipment_categories p ON c.parent_id = p.id
      WHERE c.id = ?
    `).get(id);
    res.json({
      id: row.id,
      name: row.name,
      description: row.description || null,
      parentId: row.parent_id || null,
      parentName: row.parent_name || null,
      equipmentCount: row.equipment_count ?? 0
    });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Une catégorie avec ce nom existe déjà' });
    throw e;
  }
});

router.delete('/categories/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const id = parseInt(req.params.id);
  const cat = db.prepare('SELECT id, name FROM equipment_categories WHERE id = ?').get(id);
  if (!cat) return res.status(404).json({ error: 'Catégorie non trouvée' });
  const used = db.prepare('SELECT COUNT(*) as c FROM equipment WHERE category_id = ?').get(id);
  if (used.c > 0) return res.status(400).json({ error: 'Impossible de supprimer : des équipements utilisent cette catégorie. Réaffectez-les ou supprimez-les.' });
  const childCount = db.prepare('SELECT COUNT(*) as c FROM equipment_categories WHERE parent_id = ?').get(id);
  if (childCount.c > 0) return res.status(400).json({ error: 'Impossible de supprimer : des sous-catégories existent. Supprimez ou réaffectez-les d\'abord.' });
  db.prepare('DELETE FROM equipment_categories WHERE id = ?').run(id);
  res.status(204).send();
});

/**
 * POST /api/equipment/from-model — Créer un équipement à partir d'un modèle (template)
 */
router.post('/from-model', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('modelId').isInt(),
  body('name').notEmpty().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const model = db.prepare('SELECT * FROM equipment_models WHERE id = ?').get(req.body.modelId);
  if (!model) return res.status(404).json({ error: 'Modèle non trouvé' });
  const { code: codeProvided, name, ligneId, parentId, serialNumber, installationDate, location } = req.body;
  const code = codification.generateCodeIfNeeded(db, 'machine', codeProvided);
  if (!code || !code.trim()) return res.status(400).json({ error: 'Code requis ou configurer la codification dans Paramétrage' });
  try {
    const result = db.prepare(`
      INSERT INTO equipment (code, name, description, category_id, ligne_id, parent_id, serial_number, manufacturer, model, installation_date, location, technical_specs, criticite, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code.trim(),
      name,
      req.body.description != null ? req.body.description : model.description,
      model.category_id,
      ligneId || null,
      parentId || null,
      serialNumber || null,
      model.manufacturer,
      model.model,
      installationDate || null,
      location || null,
      model.technical_specs,
      'B',
      'operational'
    );
    const newId = result.lastInsertRowid;
    const newRow = db.prepare('SELECT e.*, c.name as category_name, l.name as ligne_name FROM equipment e LEFT JOIN equipment_categories c ON e.category_id = c.id LEFT JOIN lignes l ON e.ligne_id = l.id WHERE e.id = ?').get(newId);
    auditService.log(db, 'equipment', newId, 'created', { userId: req.user?.id, userEmail: req.user?.email, summary: newRow?.code || newRow?.name });
    res.status(201).json(formatEquipment(newRow));
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Code équipement déjà existant' });
    throw e;
  }
});

/**
 * POST /api/equipment/:id/clone — Cloner un équipement (copie champs + optionnel BOM et plans)
 */
router.post('/:id/clone', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), [
  body('code').notEmpty().trim(),
  body('name').notEmpty().trim(),
  body('copyBom').optional().isBoolean(),
  body('copyPlans').optional().isBoolean()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const sourceId = req.params.id;
  const source = db.prepare('SELECT * FROM equipment WHERE id = ?').get(sourceId);
  if (!source) return res.status(404).json({ error: 'Équipement source non trouvé' });
  const { code, name, copyBom, copyPlans } = req.body;
  const description = req.body.description != null ? req.body.description : source.description;
  try {
    const result = db.prepare(`
      INSERT INTO equipment (code, name, description, category_id, ligne_id, parent_id, serial_number, manufacturer, model, installation_date, location, technical_specs, criticite, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code.trim(),
      name,
      description,
      source.category_id,
      req.body.ligneId != null ? req.body.ligneId : source.ligne_id,
      null,
      req.body.serialNumber || null,
      source.manufacturer,
      source.model,
      null,
      source.location,
      source.technical_specs,
      source.criticite || 'B',
      'operational'
    );
    const newId = result.lastInsertRowid;
    if (copyBom) {
      try {
        const bomRows = db.prepare('SELECT spare_part_id, quantity FROM equipment_spare_parts WHERE equipment_id = ?').all(sourceId);
        const insertBom = db.prepare('INSERT INTO equipment_spare_parts (equipment_id, spare_part_id, quantity) VALUES (?, ?, ?)');
        bomRows.forEach((r) => insertBom.run(newId, r.spare_part_id, r.quantity));
      } catch (e) {
        if (!e.message || !e.message.includes('no such table')) throw e;
      }
    }
    if (copyPlans) {
      try {
        const plans = db.prepare('SELECT name, description, frequency_days FROM maintenance_plans WHERE equipment_id = ?').all(sourceId);
        const now = new Date();
        now.setDate(now.getDate() + (plans[0]?.frequency_days || 30));
        const nextDue = now.toISOString().split('T')[0];
        try {
          const insertPlan = db.prepare(`
            INSERT INTO maintenance_plans (equipment_id, name, description, frequency_days, next_due_date, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
          `);
          plans.forEach((p) => insertPlan.run(newId, p.name, p.description || null, p.frequency_days || 30, nextDue));
        } catch (insErr) {
          if (!insErr.message || !insErr.message.includes('no such table')) throw insErr;
        }
      } catch (e) {
        if (!e.message || !e.message.includes('no such table')) throw e;
      }
    }
    const newRow = db.prepare('SELECT e.*, c.name as category_name, l.name as ligne_name FROM equipment e LEFT JOIN equipment_categories c ON e.category_id = c.id LEFT JOIN lignes l ON e.ligne_id = l.id WHERE e.id = ?').get(newId);
    auditService.log(db, 'equipment', newId, 'created', { userId: req.user?.id, userEmail: req.user?.email, summary: newRow?.code || newRow?.name });
    res.status(201).json(formatEquipment(newRow));
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Code équipement déjà existant' });
    throw e;
  }
});

router.get('/:id/history', param('id').isInt(), (req, res) => {
  if (validateIdParam(req, res)) return;
  const db = req.db;
  try {
    const workOrders = db.prepare(`
      SELECT wo.id, wo.number, wo.title, wo.description, wo.status, wo.created_at,
             t.name as type_name, u.first_name || ' ' || u.last_name as assigned_name,
             (SELECT COALESCE(SUM(i.hours_spent), 0) FROM interventions i WHERE i.work_order_id = wo.id) as total_hours
      FROM work_orders wo
      LEFT JOIN work_order_types t ON wo.type_id = t.id
      LEFT JOIN users u ON wo.assigned_to = u.id
      WHERE wo.equipment_id = ?
      ORDER BY wo.created_at DESC
    `).all(req.params.id);
    res.json(workOrders);
  } catch (err) {
    if (err.message && err.message.includes('no such table')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/documents', (req, res) => {
  const db = req.db;
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
  const db = req.db;
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
  if (validateIdParam(req, res)) return;
  const db = req.db;
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
  const db = req.db;
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
    try {
      db.prepare('INSERT INTO equipment_counter_history (equipment_id, counter_type, value, source) VALUES (?, ?, ?, ?)').run(id, counterType, value, 'manual');
      if (db._save) db._save();
    } catch (_) {}
    const row = db.prepare('SELECT * FROM equipment_counters WHERE equipment_id = ? AND counter_type = ?').get(id, counterType);
    res.json({ id: row.id, equipmentId: row.equipment_id, counterType: row.counter_type, value: row.value, unit: row.unit || 'h', updatedAt: row.updated_at });
  } catch (err) {
    if (err.message && err.message.includes('no such table')) return res.status(501).json({ error: 'Table equipment_counters non disponible' });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/equipment/:id/total-cost
 * Coût total vie de l'actif : main d'œuvre + pièces + sous-traitance (tous OT liés)
 */
router.get('/:id/total-cost', param('id').isInt(), (req, res) => {
  if (validateIdParam(req, res)) return;
  const db = req.db;
  const id = req.params.id;
  const eq = db.prepare('SELECT id, code, name FROM equipment WHERE id = ?').get(id);
  if (!eq) return res.status(404).json({ error: 'Équipement non trouvé' });
  const getWorkOrderCosts = require('./workOrders').getWorkOrderCosts;
  let laborCost = 0; let partsCost = 0; let extraCost = 0; let subcontractCost = 0;
  try {
    const woIds = db.prepare('SELECT id FROM work_orders WHERE equipment_id = ?').all(id).map((r) => r.id);
    for (const woId of woIds) {
      const costs = getWorkOrderCosts(db, woId);
      if (costs) {
        laborCost += costs.laborCost || 0;
        partsCost += costs.partsCost || 0;
        extraCost += costs.extraFeesCost || 0;
      }
    }
    const sub = db.prepare('SELECT COALESCE(SUM(amount), 0) as s FROM subcontract_orders WHERE work_order_id IN (SELECT id FROM work_orders WHERE equipment_id = ?)').get(id);
    subcontractCost = sub?.s ?? 0;
  } catch (e) {
    if (!e.message || !e.message.includes('no such table')) throw e;
  }
  const total = laborCost + partsCost + extraCost + subcontractCost;
  res.json({
    equipmentId: id,
    equipmentCode: eq.code,
    equipmentName: eq.name,
    laborCost: Math.round(laborCost * 100) / 100,
    partsCost: Math.round(partsCost * 100) / 100,
    extraFeesCost: Math.round(extraCost * 100) / 100,
    subcontractCost: Math.round(subcontractCost * 100) / 100,
    totalCost: Math.round(total * 100) / 100
  });
});

/**
 * GET /api/equipment/:id/counter-history
 * Historique des compteurs pour courbes (équipement_counter_history)
 */
router.get('/:id/counter-history', param('id').isInt(), (req, res) => {
  if (validateIdParam(req, res)) return;
  const db = req.db;
  const id = req.params.id;
  const eq = db.prepare('SELECT id FROM equipment WHERE id = ?').get(id);
  if (!eq) return res.status(404).json({ error: 'Équipement non trouvé' });
  const { counterType, limit } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 100, 500);
  try {
    let sql = 'SELECT id, equipment_id, counter_type, value, recorded_at, source FROM equipment_counter_history WHERE equipment_id = ?';
    const params = [id];
    if (counterType) { sql += ' AND counter_type = ?'; params.push(counterType); }
    sql += ' ORDER BY recorded_at DESC LIMIT ?';
    params.push(lim);
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map((r) => ({ id: r.id, equipmentId: r.equipment_id, counterType: r.counter_type, value: r.value, recordedAt: r.recorded_at, source: r.source })));
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});

router.post('/:id/counter-history', authorize(ROLES.ADMIN, ROLES.RESPONSABLE, ROLES.TECHNICIEN), param('id').isInt(), [
  body('counterType').notEmpty().trim(),
  body('value').isFloat({ min: 0 })
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = req.params.id;
  if (!db.prepare('SELECT id FROM equipment WHERE id = ?').get(id)) return res.status(404).json({ error: 'Équipement non trouvé' });
  try {
    const r = db.prepare('INSERT INTO equipment_counter_history (equipment_id, counter_type, value, source) VALUES (?, ?, ?, ?)').run(id, req.body.counterType, parseFloat(req.body.value), req.body.source || 'manual');
    const row = db.prepare('SELECT id, equipment_id, counter_type, value, recorded_at FROM equipment_counter_history WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json(row ? { id: row.id, equipmentId: row.equipment_id, counterType: row.counter_type, value: row.value, recordedAt: row.recorded_at } : {});
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(501).json({ error: 'Table equipment_counter_history non disponible' });
    throw e;
  }
});

/**
 * GET /api/equipment/:id/thresholds
 * Seuils IoT / prévisionnel pour un équipement
 */
router.get('/:id/thresholds', param('id').isInt(), (req, res) => {
  if (validateIdParam(req, res)) return;
  const db = req.db;
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
  const db = req.db;
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
  const db = req.db;
  const result = db.prepare('DELETE FROM equipment_thresholds WHERE id = ? AND equipment_id = ?').run(req.params.tid, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Seuil non trouvé' });
  res.status(204).send();
});

/**
 * GET /api/equipment/:id/bom — Nomenclature (liste des pièces liées à l'équipement)
 */
router.get('/:id/bom', param('id').isInt(), (req, res) => {
  if (validateIdParam(req, res)) return;
  const db = req.db;
  const equipmentId = req.params.id;
  const exists = db.prepare('SELECT id FROM equipment WHERE id = ?').get(equipmentId);
  if (!exists) return res.status(404).json({ error: 'Équipement non trouvé' });
  const rows = db.prepare(`
    SELECT esp.equipment_id, esp.spare_part_id, esp.quantity,
           sp.code as part_code, sp.name as part_name, sp.unit, sp.unit_price,
           COALESCE(sb.quantity, 0) as stock_quantity
    FROM equipment_spare_parts esp
    JOIN spare_parts sp ON esp.spare_part_id = sp.id
    LEFT JOIN stock_balance sb ON sp.id = sb.spare_part_id
    WHERE esp.equipment_id = ?
    ORDER BY sp.code
  `).all(equipmentId);
  res.json(rows.map(r => ({
    equipmentId: r.equipment_id,
    sparePartId: r.spare_part_id,
    quantity: r.quantity,
    partCode: r.part_code,
    partName: r.part_name,
    unit: r.unit,
    unitPrice: r.unit_price,
    stockQuantity: r.stock_quantity
  })));
});

/**
 * POST /api/equipment/:id/bom — Ajouter une pièce à la nomenclature
 */
router.post('/:id/bom', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), [
  body('sparePartId').isInt(),
  body('quantity').optional().isInt({ min: 1 })
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const equipmentId = req.params.id;
  const sparePartId = req.body.sparePartId;
  const quantity = req.body.quantity || 1;
  const exists = db.prepare('SELECT id FROM equipment WHERE id = ?').get(equipmentId);
  if (!exists) return res.status(404).json({ error: 'Équipement non trouvé' });
  const partExists = db.prepare('SELECT id FROM spare_parts WHERE id = ?').get(sparePartId);
  if (!partExists) return res.status(404).json({ error: 'Pièce non trouvée' });
  try {
    db.prepare(`
      INSERT INTO equipment_spare_parts (equipment_id, spare_part_id, quantity)
      VALUES (?, ?, ?)
      ON CONFLICT(equipment_id, spare_part_id) DO UPDATE SET quantity = excluded.quantity
    `).run(equipmentId, sparePartId, quantity);
  } catch (e) {
    if (e.message && e.message.includes('FOREIGN KEY')) return res.status(400).json({ error: 'Équipement ou pièce invalide' });
    throw e;
  }
  const row = db.prepare(`
    SELECT esp.*, sp.code as part_code, sp.name as part_name
    FROM equipment_spare_parts esp JOIN spare_parts sp ON esp.spare_part_id = sp.id
    WHERE esp.equipment_id = ? AND esp.spare_part_id = ?
  `).get(equipmentId, sparePartId);
  res.status(201).json({ equipmentId: row.equipment_id, sparePartId: row.spare_part_id, quantity: row.quantity, partCode: row.part_code, partName: row.part_name });
});

/**
 * DELETE /api/equipment/:id/bom/:sparePartId — Retirer une pièce de la nomenclature
 */
router.delete('/:id/bom/:sparePartId', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), param('sparePartId').isInt(), (req, res) => {
  const db = req.db;
  const result = db.prepare('DELETE FROM equipment_spare_parts WHERE equipment_id = ? AND spare_part_id = ?').run(req.params.id, req.params.sparePartId);
  if (result.changes === 0) return res.status(404).json({ error: 'Ligne de nomenclature non trouvée' });
  res.status(204).send();
});

router.get('/:id', param('id').isInt(), (req, res) => {
  if (validateIdParam(req, res)) return;
  const db = req.db;
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

router.post('/', requirePermission('equipment', 'create'), [
  body('name').notEmpty().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { code: codeProvided, name, description, categoryId, parentId, serialNumber, manufacturer, model, installationDate, location, technicalSpecs, status } = req.body;
  const code = codification.generateCodeIfNeeded(db, 'machine', codeProvided);
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
    auditService.log(db, 'equipment', result.lastInsertRowid, 'created', { userId: req.user?.id, userEmail: req.user?.email, summary: newRow?.code || newRow?.name });
    res.status(201).json(formatEquipment(newRow));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Code equipement deja existant' });
    throw e;
  }
});

router.put('/:id', requirePermission('equipment', 'update'), param('id').isInt(), (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const existing = db.prepare('SELECT id FROM equipment WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Equipement non trouve' });
  const fields = ['code', 'name', 'description', 'category_id', 'ligne_id', 'parent_id', 'serial_number', 'manufacturer', 'model', 'installation_date', 'location', 'criticite', 'status', 'acquisition_value', 'depreciation_years', 'residual_value', 'depreciation_start_date', 'target_cost_per_operating_hour'];
  const mapping = { categoryId: 'category_id', ligneId: 'ligne_id', parentId: 'parent_id', serialNumber: 'serial_number', installationDate: 'installation_date', acquisitionValue: 'acquisition_value', depreciationYears: 'depreciation_years', residualValue: 'residual_value', depreciationStartDate: 'depreciation_start_date', targetCostPerOperatingHour: 'target_cost_per_operating_hour' };
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
  auditService.log(db, 'equipment', id, 'updated', { userId: req.user?.id, userEmail: req.user?.email, summary: row?.code || row?.name });
  res.json(formatEquipment(row));
});

router.delete('/:id', requirePermission('equipment', 'delete'), param('id').isInt(), (req, res) => {
  const db = req.db;
  const id = parseInt(req.params.id, 10);
  const eq = db.prepare('SELECT code, name FROM equipment WHERE id = ?').get(id);
  if (!eq) return res.status(404).json({ error: 'Équipement non trouvé' });

  const hasWo = db.prepare('SELECT 1 FROM work_orders WHERE equipment_id = ? LIMIT 1').get(id);
  if (hasWo) return res.status(400).json({ error: 'Impossible de supprimer : cet équipement est référencé par un ou plusieurs ordres de travail. Supprimez ou réaffectez les OT avant suppression.' });
  const hasPlans = db.prepare('SELECT 1 FROM maintenance_plans WHERE equipment_id = ? LIMIT 1').get(id);
  if (hasPlans) return res.status(400).json({ error: 'Impossible de supprimer : cet équipement est référencé par des plans de maintenance. Supprimez ou réaffectez les plans avant suppression.' });
  try {
    const hasContracts = db.prepare('SELECT 1 FROM maintenance_contracts WHERE equipment_id = ? LIMIT 1').get(id);
    if (hasContracts) return res.status(400).json({ error: 'Impossible de supprimer : cet équipement est lié à un ou plusieurs contrats de maintenance.' });
  } catch (t) {
    if (!t.message || !t.message.includes('no such table')) throw t;
  }
  try {
    const hasWarranties = db.prepare('SELECT 1 FROM warranties WHERE equipment_id = ? LIMIT 1').get(id);
    if (hasWarranties) return res.status(400).json({ error: 'Impossible de supprimer : cet équipement possède des garanties enregistrées.' });
  } catch (t) {
    if (!t.message || !t.message.includes('no such table')) throw t;
  }
  try {
    const hasIntervention = db.prepare('SELECT 1 FROM intervention_requests WHERE equipment_id = ? LIMIT 1').get(id);
    if (hasIntervention) return res.status(400).json({ error: 'Impossible de supprimer : cet équipement est référencé par des demandes d\'intervention.' });
  } catch (t) {
    if (!t.message || !t.message.includes('no such table')) throw t;
  }

  try {
    db.prepare('UPDATE equipment SET parent_id = NULL WHERE parent_id = ?').run(id);
    const result = db.prepare('DELETE FROM equipment WHERE id = ?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Équipement non trouvé' });
    auditService.log(db, 'equipment', id, 'deleted', { userId: req.user?.id, userEmail: req.user?.email, summary: eq ? `${eq.code} ${eq.name}` : null });
    res.status(204).send();
  } catch (e) {
    if (e.message && e.message.includes('FOREIGN KEY')) {
      return res.status(400).json({ error: 'Impossible de supprimer : équipement encore référencé (documents, nomenclature, seuils, etc.). Supprimez d\'abord les éléments associés.' });
    }
    throw e;
  }
});

module.exports = router;
