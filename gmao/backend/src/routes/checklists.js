/**
 * Routes pour la gestion des checklists de maintenance
 */

const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);

router.get('/', requirePermission('checklists', 'view'), (req, res) => {
  const db = req.db;
  try {
    try {
      db.prepare('SELECT 1 FROM maintenance_checklists LIMIT 1').get();
    } catch (err) {
      if (err.message.includes('no such table')) {
        return res.json([]);
      }
      throw err;
    }

    const { maintenance_plan_id, is_template } = req.query;
    let query = `
      SELECT c.*, mp.equipment_id, e.code as equipment_code, e.name as equipment_name
      FROM maintenance_checklists c
      LEFT JOIN maintenance_plans mp ON c.maintenance_plan_id = mp.id
      LEFT JOIN equipment e ON mp.equipment_id = e.id
      WHERE 1=1
    `;
    const params = [];

    if (maintenance_plan_id) {
      query += ' AND c.maintenance_plan_id = ?';
      params.push(maintenance_plan_id);
    }
    if (is_template !== undefined) {
      query += ' AND c.is_template = ?';
      params.push(is_template === 'true' ? 1 : 0);
    }

    query += ' ORDER BY c.created_at DESC';

    const rows = db.prepare(query).all(...params);
    const byId = new Map();
    rows.forEach((r) => { if (!byId.has(r.id)) byId.set(r.id, r); });
    // Une seule entrée par (nom + plan) pour éviter doublons d'affichage
    const byKey = new Map();
    [...byId.values()].forEach((r) => {
      const key = `${r.name || ''}|${r.maintenance_plan_id ?? ''}`;
      if (!byKey.has(key)) byKey.set(key, r);
    });
    const checklists = [...byKey.values()];
    // Charger les items pour chaque checklist
    const checklistsWithItems = checklists.map(checklist => {
      const items = db.prepare('SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY order_index').all(checklist.id);
      return { ...checklist, items };
    });

    res.json(checklistsWithItems);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', requirePermission('checklists', 'view'), (req, res) => {
  const db = req.db;
  try {
    const checklist = db.prepare('SELECT * FROM maintenance_checklists WHERE id = ?').get(req.params.id);
    if (!checklist) {
      return res.status(404).json({ error: 'Checklist non trouvée' });
    }

    const items = db.prepare('SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY order_index').all(req.params.id);
    res.json({ ...checklist, items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', requirePermission('checklists', 'create'), (req, res) => {
  const db = req.db;
  try {
    const { maintenance_plan_id, name, description, is_template, items } = req.body;
    const result = db.prepare(`
      INSERT INTO maintenance_checklists (maintenance_plan_id, name, description, is_template)
      VALUES (?, ?, ?, ?)
    `).run(
      maintenance_plan_id || null,
      name,
      description || null,
      is_template ? 1 : 0
    );

    const checklistId = result.lastInsertRowid;

    // Ajouter les items
    if (items && Array.isArray(items)) {
      const insertItem = db.prepare(`
        INSERT INTO checklist_items (checklist_id, item_text, item_type, required, expected_value, unit, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      items.forEach((item, index) => {
        insertItem.run(
          checklistId,
          item.item_text,
          item.item_type || 'check',
          item.required !== undefined ? (item.required ? 1 : 0) : 1,
          item.expected_value || null,
          item.unit || null,
          item.order_index !== undefined ? item.order_index : index
        );
      });
    }

    const checklist = db.prepare('SELECT * FROM maintenance_checklists WHERE id = ?').get(checklistId);
    const checklistItems = db.prepare('SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY order_index').all(checklistId);
    res.status(201).json({ ...checklist, items: checklistItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', requirePermission('checklists', 'update'), (req, res) => {
  const db = req.db;
  try {
    const { name, description, maintenance_plan_id, items } = req.body;
    const updates = ['name = ?', 'description = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [name, description || null];
    if (maintenance_plan_id !== undefined) {
      updates.push('maintenance_plan_id = ?');
      values.push(maintenance_plan_id ? maintenance_plan_id : null);
    }
    values.push(req.params.id);
    db.prepare(`
      UPDATE maintenance_checklists
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    // Mettre à jour les items
    if (items && Array.isArray(items)) {
      // Supprimer les anciens items
      db.prepare('DELETE FROM checklist_items WHERE checklist_id = ?').run(req.params.id);

      // Ajouter les nouveaux items
      const insertItem = db.prepare(`
        INSERT INTO checklist_items (checklist_id, item_text, item_type, required, expected_value, unit, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      items.forEach((item, index) => {
        insertItem.run(
          req.params.id,
          item.item_text,
          item.item_type || 'check',
          item.required !== undefined ? (item.required ? 1 : 0) : 1,
          item.expected_value || null,
          item.unit || null,
          item.order_index !== undefined ? item.order_index : index
        );
      });
    }

    const checklist = db.prepare('SELECT * FROM maintenance_checklists WHERE id = ?').get(req.params.id);
    const checklistItems = db.prepare('SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY order_index').all(req.params.id);
    res.json({ ...checklist, items: checklistItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/execute', (req, res) => {
  const db = req.db;
  try {
    const { work_order_id, results, notes } = req.body;
    const userId = req.user?.id;
    const checklistId = parseInt(req.params.id, 10);
    if (Number.isNaN(checklistId)) return res.status(400).json({ error: 'ID invalide' });
    const checklist = db.prepare('SELECT id FROM maintenance_checklists WHERE id = ?').get(checklistId);
    if (!checklist) return res.status(404).json({ error: 'Checklist non trouvée' });

    const execResult = db.prepare(`
      INSERT INTO checklist_executions (checklist_id, work_order_id, executed_by, notes)
      VALUES (?, ?, ?, ?)
    `).run(checklistId, work_order_id != null ? work_order_id : null, userId, notes || null);

    const executionId = execResult.lastInsertRowid;

    // Enregistrer les résultats des items
    if (results && Array.isArray(results)) {
      const insertResult = db.prepare(`
        INSERT INTO checklist_item_results (execution_id, item_id, value, is_ok, photo_path, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      results.forEach(result => {
        insertResult.run(
          executionId,
          result.item_id,
          result.value || null,
          result.is_ok !== undefined ? (result.is_ok ? 1 : 0) : null,
          result.photo_path || null,
          result.notes || null
        );
      });
    }

    const execution = db.prepare(`
      SELECT ce.*, u.first_name || ' ' || u.last_name as executed_by_name
      FROM checklist_executions ce
      LEFT JOIN users u ON ce.executed_by = u.id
      WHERE ce.id = ?
    `).get(executionId);

    const executionResults = db.prepare(`
      SELECT cir.*, ci.item_text, ci.item_type
      FROM checklist_item_results cir
      JOIN checklist_items ci ON cir.item_id = ci.id
      WHERE cir.execution_id = ?
    `).all(executionId);

    res.status(201).json({ ...execution, results: executionResults });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/executions', (req, res) => {
  const db = req.db;
  try {
    const executions = db.prepare(`
      SELECT ce.*, u.first_name || ' ' || u.last_name as executed_by_name, wo.number as work_order_number
      FROM checklist_executions ce
      LEFT JOIN users u ON ce.executed_by = u.id
      LEFT JOIN work_orders wo ON ce.work_order_id = wo.id
      WHERE ce.checklist_id = ?
      ORDER BY ce.executed_at DESC
    `).all(req.params.id);

    const executionsWithResults = executions.map(exec => {
      const results = db.prepare(`
        SELECT cir.*, ci.item_text, ci.item_type
        FROM checklist_item_results cir
        JOIN checklist_items ci ON cir.item_id = ci.id
        WHERE cir.execution_id = ?
      `).all(exec.id);
      return { ...exec, results };
    });

    res.json(executionsWithResults);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', requirePermission('checklists', 'delete'), (req, res) => {
  const db = req.db;
  try {
    db.prepare('DELETE FROM checklist_items WHERE checklist_id = ?').run(req.params.id);
    db.prepare('DELETE FROM maintenance_checklists WHERE id = ?').run(req.params.id);
    res.json({ message: 'Checklist supprimée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
