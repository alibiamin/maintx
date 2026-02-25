/**
 * Routes pour la gestion des contrats de maintenance
 */

const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);

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

    const { supplier_id, equipment_id, is_active } = req.query;
    let query = `
      SELECT c.*, s.name as supplier_name, e.code as equipment_code, e.name as equipment_name,
             u.first_name || ' ' || u.last_name as created_by_name
      FROM maintenance_contracts c
      LEFT JOIN suppliers s ON c.supplier_id = s.id
      LEFT JOIN equipment e ON c.equipment_id = e.id
      LEFT JOIN users u ON c.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (supplier_id) {
      query += ' AND c.supplier_id = ?';
      params.push(supplier_id);
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

    const contracts = db.prepare(query).all(...params);
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
      SELECT c.*, s.name as supplier_name, e.code as equipment_code, e.name as equipment_name
      FROM maintenance_contracts c
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
    const contract = db.prepare(`
      SELECT c.*, s.name as supplier_name, s.email as supplier_email, s.phone as supplier_phone,
             e.code as equipment_code, e.name as equipment_name,
             u.first_name || ' ' || u.last_name as created_by_name
      FROM maintenance_contracts c
      LEFT JOIN suppliers s ON c.supplier_id = s.id
      LEFT JOIN equipment e ON c.equipment_id = e.id
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!contract) {
      return res.status(404).json({ error: 'Contrat non trouvé' });
    }

    res.json(contract);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', requirePermission('contracts', 'create'), (req, res) => {
  const db = req.db;
  try {
    const {
      contract_number,
      name,
      supplier_id,
      equipment_id,
      contract_type,
      start_date,
      end_date,
      annual_cost,
      frequency_days,
      description,
      terms
    } = req.body;

    const userId = req.user?.id || null;

    const result = db.prepare(`
      INSERT INTO maintenance_contracts (
        contract_number, name, supplier_id, equipment_id, contract_type,
        start_date, end_date, annual_cost, frequency_days, description, terms, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      contract_number,
      name,
      supplier_id,
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
    const {
      name,
      contract_type,
      start_date,
      end_date,
      annual_cost,
      frequency_days,
      description,
      terms,
      is_active
    } = req.body;

    db.prepare(`
      UPDATE maintenance_contracts
      SET name = ?, contract_type = ?, start_date = ?, end_date = ?,
          annual_cost = ?, frequency_days = ?, description = ?, terms = ?,
          is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name,
      contract_type,
      start_date,
      end_date,
      annual_cost,
      frequency_days,
      description,
      terms,
      is_active !== undefined ? (is_active ? 1 : 0) : undefined,
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
