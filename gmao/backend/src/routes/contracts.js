/**
 * Routes pour la gestion des contrats de sous-traitance (maintenance).
 * Les contrats sont liés aux prestataires externes (sous-traitance), pas aux fournisseurs (achats pièces).
 */

const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);

function hasContractLinkColumns(db) {
  try {
    db.prepare('SELECT work_order_id FROM maintenance_contracts LIMIT 1').get();
    return true;
  } catch (e) {
    return false;
  }
}

const listSelectBase = `
  c.*,
  ec.name as contractor_name, ec.code as contractor_code,
  s.name as supplier_name,
  e.code as equipment_code, e.name as equipment_name,
  u.first_name || ' ' || u.last_name as created_by_name
`;
const listSelectWithLinks = `
  c.*,
  ec.name as contractor_name, ec.code as contractor_code,
  s.name as supplier_name,
  e.code as equipment_code, e.name as equipment_name,
  u.first_name || ' ' || u.last_name as created_by_name,
  wo.number as wo_number, wo.title as wo_title,
  mp.name as plan_name, mproj.name as project_name
`;
const listFromJoins = `
  FROM maintenance_contracts c
  LEFT JOIN external_contractors ec ON c.external_contractor_id = ec.id
  LEFT JOIN suppliers s ON c.supplier_id = s.id
  LEFT JOIN equipment e ON c.equipment_id = e.id
  LEFT JOIN users u ON c.created_by = u.id
`;
const listFromJoinsWithLinks = `
  FROM maintenance_contracts c
  LEFT JOIN external_contractors ec ON c.external_contractor_id = ec.id
  LEFT JOIN suppliers s ON c.supplier_id = s.id
  LEFT JOIN equipment e ON c.equipment_id = e.id
  LEFT JOIN users u ON c.created_by = u.id
  LEFT JOIN work_orders wo ON c.work_order_id = wo.id
  LEFT JOIN maintenance_plans mp ON c.maintenance_plan_id = mp.id
  LEFT JOIN maintenance_projects mproj ON c.maintenance_project_id = mproj.id
`;

router.get('/', requirePermission('contracts', 'view'), (req, res) => {
  const db = req.db;
  try {
    try {
      db.prepare('SELECT 1 FROM maintenance_contracts LIMIT 1').get();
    } catch (err) {
      if (err.message.includes('no such table')) {
        return res.json([]);
      }
      throw err;
    }

    const { external_contractor_id, equipment_id, is_active } = req.query;
    let query;
    const params = [];
    const withLinks = hasContractLinkColumns(db);
    const selectPart = withLinks ? listSelectWithLinks : listSelectBase;
    const fromPart = withLinks ? listFromJoinsWithLinks : listFromJoins;
    query = `SELECT ${selectPart} ${fromPart} WHERE 1=1`;

    if (external_contractor_id) {
      query += ' AND c.external_contractor_id = ?';
      params.push(external_contractor_id);
    }
    if (equipment_id) {
      query += ' AND c.equipment_id = ?';
      params.push(equipment_id);
    }
    if (is_active !== undefined) {
      query += ' AND c.is_active = ?';
      params.push(is_active === 'true' ? 1 : 0);
    }

    query += ' ORDER BY c.end_date DESC';

    let contracts;
    try {
      contracts = db.prepare(query).all(...params);
    } catch (queryErr) {
      if (queryErr.message && (queryErr.message.includes('no such column') || queryErr.message.includes('no such table'))) {
        try {
          query = `SELECT ${listSelectBase} ${listFromJoins} WHERE 1=1`;
          if (external_contractor_id) query += ' AND c.external_contractor_id = ?';
          if (equipment_id) query += ' AND c.equipment_id = ?';
          if (is_active !== undefined) query += ' AND c.is_active = ?';
          query += ' ORDER BY c.end_date DESC';
          contracts = db.prepare(query).all(...params);
        } catch (fallbackErr) {
          if (fallbackErr.message && (fallbackErr.message.includes('no such column') || fallbackErr.message.includes('no such table'))) {
            let minQuery = 'SELECT * FROM maintenance_contracts WHERE 1=1';
            const minParams = [];
            if (external_contractor_id) { minQuery += ' AND external_contractor_id = ?'; minParams.push(external_contractor_id); }
            if (equipment_id) { minQuery += ' AND equipment_id = ?'; minParams.push(equipment_id); }
            if (is_active !== undefined) { minQuery += ' AND is_active = ?'; minParams.push(is_active === 'true' ? 1 : 0); }
            minQuery += ' ORDER BY end_date DESC';
            contracts = db.prepare(minQuery).all(...minParams);
          } else {
            throw fallbackErr;
          }
        }
      } else {
        throw queryErr;
      }
    }
    res.json(contracts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/expiring', requirePermission('contracts', 'view'), (req, res) => {
  const db = req.db;
  try {
    const days = parseInt(req.query.days || 30);
    const contracts = db.prepare(`
      SELECT c.*, ec.name as contractor_name, s.name as supplier_name, e.code as equipment_code, e.name as equipment_name
      FROM maintenance_contracts c
      LEFT JOIN external_contractors ec ON c.external_contractor_id = ec.id
      LEFT JOIN suppliers s ON c.supplier_id = s.id
      LEFT JOIN equipment e ON c.equipment_id = e.id
      WHERE c.is_active = 1
        AND c.end_date <= date('now', '+' || ? || ' days')
        AND c.end_date >= date('now')
      ORDER BY c.end_date ASC
    `).all(days);
    res.json(contracts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', requirePermission('contracts', 'view'), (req, res) => {
  const db = req.db;
  try {
    const withLinks = hasContractLinkColumns(db);
    const extraSelect = withLinks
      ? ', wo.number as wo_number, wo.title as wo_title, mp.name as plan_name, mproj.name as project_name'
      : '';
    const extraJoins = withLinks
      ? ' LEFT JOIN work_orders wo ON c.work_order_id = wo.id LEFT JOIN maintenance_plans mp ON c.maintenance_plan_id = mp.id LEFT JOIN maintenance_projects mproj ON c.maintenance_project_id = mproj.id'
      : '';
    let contract;
    try {
      contract = db.prepare(`
        SELECT c.*,
               ec.name as contractor_name, ec.code as contractor_code, ec.email as contractor_email, ec.phone as contractor_phone,
               s.name as supplier_name, s.email as supplier_email, s.phone as supplier_phone,
               e.code as equipment_code, e.name as equipment_name,
               u.first_name || ' ' || u.last_name as created_by_name
               ${extraSelect}
        FROM maintenance_contracts c
        LEFT JOIN external_contractors ec ON c.external_contractor_id = ec.id
        LEFT JOIN suppliers s ON c.supplier_id = s.id
        LEFT JOIN equipment e ON c.equipment_id = e.id
        LEFT JOIN users u ON c.created_by = u.id
        ${extraJoins}
        WHERE c.id = ?
      `).get(req.params.id);
    } catch (queryErr) {
      if (queryErr.message && (queryErr.message.includes('no such column') || queryErr.message.includes('no such table'))) {
        contract = db.prepare(`
          SELECT c.*,
                 ec.name as contractor_name, ec.code as contractor_code, ec.email as contractor_email, ec.phone as contractor_phone,
                 s.name as supplier_name, s.email as supplier_email, s.phone as supplier_phone,
                 e.code as equipment_code, e.name as equipment_name,
                 u.first_name || ' ' || u.last_name as created_by_name
          FROM maintenance_contracts c
          LEFT JOIN external_contractors ec ON c.external_contractor_id = ec.id
          LEFT JOIN suppliers s ON c.supplier_id = s.id
          LEFT JOIN equipment e ON c.equipment_id = e.id
          LEFT JOIN users u ON c.created_by = u.id
          WHERE c.id = ?
        `).get(req.params.id);
      } else {
        throw queryErr;
      }
    }

    if (!contract) {
      return res.status(404).json({ error: 'Contrat non trouvé' });
    }

    res.json(contract);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function normalizeContractLink(work_order_id, maintenance_plan_id, maintenance_project_id) {
  if (work_order_id) return { work_order_id: parseInt(work_order_id, 10), maintenance_plan_id: null, maintenance_project_id: null };
  if (maintenance_plan_id) return { work_order_id: null, maintenance_plan_id: parseInt(maintenance_plan_id, 10), maintenance_project_id: null };
  if (maintenance_project_id) return { work_order_id: null, maintenance_plan_id: null, maintenance_project_id: parseInt(maintenance_project_id, 10) };
  return { work_order_id: null, maintenance_plan_id: null, maintenance_project_id: null };
}

router.post('/', requirePermission('contracts', 'create'), (req, res) => {
  const db = req.db;
  try {
    const {
      contract_number,
      name,
      external_contractor_id,
      equipment_id,
      contract_type,
      start_date,
      end_date,
      annual_cost,
      frequency_days,
      description,
      terms,
      work_order_id,
      maintenance_plan_id,
      maintenance_project_id
    } = req.body;

    const userId = req.user?.id || null;
    const link = normalizeContractLink(work_order_id, maintenance_plan_id, maintenance_project_id);
    const hasLinkCols = hasContractLinkColumns(db);

    if (hasLinkCols) {
      const result = db.prepare(`
        INSERT INTO maintenance_contracts (
          contract_number, name, external_contractor_id, equipment_id, contract_type,
          start_date, end_date, annual_cost, frequency_days, description, terms, created_by,
          work_order_id, maintenance_plan_id, maintenance_project_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        contract_number,
        name,
        external_contractor_id ? parseInt(external_contractor_id, 10) : null,
        equipment_id || null,
        contract_type || 'preventive',
        start_date,
        end_date,
        annual_cost || 0,
        frequency_days || null,
        description || null,
        terms || null,
        userId,
        link.work_order_id,
        link.maintenance_plan_id,
        link.maintenance_project_id
      );
      const contract = db.prepare('SELECT * FROM maintenance_contracts WHERE id = ?').get(result.lastInsertRowid);
      return res.status(201).json(contract);
    }

    const result = db.prepare(`
      INSERT INTO maintenance_contracts (
        contract_number, name, external_contractor_id, equipment_id, contract_type,
        start_date, end_date, annual_cost, frequency_days, description, terms, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      contract_number,
      name,
      external_contractor_id ? parseInt(external_contractor_id, 10) : null,
      equipment_id || null,
      contract_type || 'preventive',
      start_date,
      end_date,
      annual_cost || 0,
      frequency_days || null,
      description || null,
      terms || null,
      userId
    );

    const contract = db.prepare('SELECT * FROM maintenance_contracts WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(contract);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Numéro de contrat déjà existant' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', requirePermission('contracts', 'update'), (req, res) => {
  const db = req.db;
  try {
    const current = db.prepare('SELECT * FROM maintenance_contracts WHERE id = ?').get(req.params.id);
    if (!current) return res.status(404).json({ error: 'Contrat non trouvé' });

    const {
      name,
      external_contractor_id,
      equipment_id,
      contract_type,
      start_date,
      end_date,
      annual_cost,
      frequency_days,
      description,
      terms,
      is_active,
      work_order_id,
      maintenance_plan_id,
      maintenance_project_id
    } = req.body;

    const contractorId = req.body.hasOwnProperty('external_contractor_id')
      ? (external_contractor_id ? parseInt(external_contractor_id, 10) : null)
      : current.external_contractor_id;

    const hasLinkCols = hasContractLinkColumns(db);
    let linkClause = '';
    const linkValues = [];
    if (hasLinkCols && (req.body.hasOwnProperty('work_order_id') || req.body.hasOwnProperty('maintenance_plan_id') || req.body.hasOwnProperty('maintenance_project_id'))) {
      const link = normalizeContractLink(
        work_order_id ?? current.work_order_id,
        maintenance_plan_id ?? current.maintenance_plan_id,
        maintenance_project_id ?? current.maintenance_project_id
      );
      linkClause = ', work_order_id = ?, maintenance_plan_id = ?, maintenance_project_id = ?';
      linkValues.push(link.work_order_id, link.maintenance_plan_id, link.maintenance_project_id);
    }

    const eqId = req.body.hasOwnProperty('equipment_id') ? (equipment_id || null) : current.equipment_id;

    db.prepare(`
      UPDATE maintenance_contracts
      SET name = ?, external_contractor_id = ?, equipment_id = ?, contract_type = ?, start_date = ?, end_date = ?,
          annual_cost = ?, frequency_days = ?, description = ?, terms = ?,
          is_active = ?, updated_at = CURRENT_TIMESTAMP
          ${linkClause}
      WHERE id = ?
    `).run(
      name ?? current.name,
      contractorId,
      eqId,
      contract_type ?? current.contract_type,
      start_date ?? current.start_date,
      end_date ?? current.end_date,
      annual_cost ?? current.annual_cost,
      frequency_days ?? current.frequency_days,
      description ?? current.description,
      terms ?? current.terms,
      is_active !== undefined ? (is_active ? 1 : 0) : current.is_active,
      ...linkValues,
      req.params.id
    );

    const contract = db.prepare('SELECT * FROM maintenance_contracts WHERE id = ?').get(req.params.id);
    res.json(contract);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', requirePermission('contracts', 'delete'), (req, res) => {
  const db = req.db;
  try {
    db.prepare('DELETE FROM maintenance_contracts WHERE id = ?').run(req.params.id);
    res.json({ message: 'Contrat supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
