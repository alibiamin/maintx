/**
 * Routes pour la gestion des outils et matériels
 */

const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const codification = require('../services/codification');

router.use(authenticate);

// GET /api/tools
router.get('/', (req, res) => {
  try {
    // Vérifier si la table existe, sinon retourner un tableau vide
    try {
      db.prepare('SELECT 1 FROM tools LIMIT 1').get();
    } catch (err) {
      if (err.message.includes('no such table')) {
        return res.json([]);
      }
      throw err;
    }

    const { status, tool_type } = req.query;
    let query = 'SELECT * FROM tools WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (tool_type) {
      query += ' AND tool_type = ?';
      params.push(tool_type);
    }

    query += ' ORDER BY name';

    const tools = db.prepare(query).all(...params);
    res.json(tools);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tools/assignments - doit être avant /:id
router.get('/assignments', (req, res) => {
  try {
    try {
      db.prepare('SELECT 1 FROM tool_assignments LIMIT 1').get();
    } catch (err) {
      if (err.message.includes('no such table')) return res.json([]);
      throw err;
    }
    const rows = db.prepare(`
      SELECT ta.*, t.name as tool_name, t.code as tool_code,
             u.first_name || ' ' || u.last_name as user_name,
             wo.number as work_order_number
      FROM tool_assignments ta
      LEFT JOIN tools t ON ta.tool_id = t.id
      LEFT JOIN users u ON ta.assigned_to = u.id
      LEFT JOIN work_orders wo ON ta.work_order_id = wo.id
      WHERE ta.returned_at IS NULL
      ORDER BY ta.assigned_at DESC
    `).all();
    const list = rows.map(r => ({
      ...r,
      toolName: r.tool_name,
      userName: r.user_name
    }));
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tools/calibrations - doit être avant /:id (liste des outils avec dates de calibration)
router.get('/calibrations', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, code, name, calibration_date, calibration_due_date,
             CASE WHEN calibration_due_date IS NULL THEN 1
                  WHEN date(calibration_due_date) >= date('now') THEN 1 ELSE 0 END as is_valid
      FROM tools
      WHERE calibration_due_date IS NOT NULL
      ORDER BY calibration_due_date ASC
    `).all();
    const list = rows.map(r => ({ ...r, toolName: r.name }));
    res.json(list);
  } catch (error) {
    if (error.message.includes('no such table')) return res.json([]);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tools/:id
router.get('/:id', (req, res) => {
  try {
    const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(req.params.id);
    if (!tool) {
      return res.status(404).json({ error: 'Outil non trouvé' });
    }

    // Charger les assignations actives
    const assignments = db.prepare(`
      SELECT ta.*, wo.number as work_order_number, wo.title as work_order_title,
             u.first_name || ' ' || u.last_name as assigned_to_name
      FROM tool_assignments ta
      LEFT JOIN work_orders wo ON ta.work_order_id = wo.id
      LEFT JOIN users u ON ta.assigned_to = u.id
      WHERE ta.tool_id = ? AND ta.returned_at IS NULL
    `).all(req.params.id);

    res.json({ ...tool, active_assignments: assignments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/tools
router.post('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), (req, res) => {
  try {
    const {
      code: codeProvided,
      name,
      description,
      tool_type,
      manufacturer,
      model,
      serial_number,
      location,
      calibration_date,
      calibration_due_date,
      purchase_date,
      purchase_price
    } = req.body;

    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nom requis' });
    const code = codification.generateCodeIfNeeded('outil', codeProvided);
    if (!code || !code.trim()) return res.status(400).json({ error: 'Code requis ou configurer la codification dans Paramétrage' });

    const result = db.prepare(`
      INSERT INTO tools (
        code, name, description, tool_type, manufacturer, model, serial_number,
        location, calibration_date, calibration_due_date, purchase_date, purchase_price
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code.trim(),
      name,
      description || null,
      tool_type || null,
      manufacturer || null,
      model || null,
      serial_number || null,
      location || null,
      calibration_date || null,
      calibration_due_date || null,
      purchase_date || null,
      purchase_price || 0
    );

    const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(tool);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Code d\'outil déjà existant' });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/tools/:id
router.put('/:id', (req, res) => {
  try {
    const {
      name,
      description,
      tool_type,
      manufacturer,
      model,
      serial_number,
      location,
      status,
      calibration_date,
      calibration_due_date,
      purchase_date,
      purchase_price
    } = req.body;

    db.prepare(`
      UPDATE tools
      SET name = ?, description = ?, tool_type = ?, manufacturer = ?, model = ?,
          serial_number = ?, location = ?, status = ?, calibration_date = ?,
          calibration_due_date = ?, purchase_date = ?, purchase_price = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name,
      description || null,
      tool_type || null,
      manufacturer || null,
      model || null,
      serial_number || null,
      location || null,
      status,
      calibration_date || null,
      calibration_due_date || null,
      purchase_date || null,
      purchase_price || 0,
      req.params.id
    );

    const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(req.params.id);
    res.json(tool);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/tools/:id/assign
router.post('/:id/assign', (req, res) => {
  try {
    const { work_order_id, assigned_to, notes } = req.body;

    // Vérifier que l'outil est disponible
    const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(req.params.id);
    if (!tool) {
      return res.status(404).json({ error: 'Outil non trouvé' });
    }

    if (tool.status !== 'available') {
      return res.status(400).json({ error: 'Outil non disponible' });
    }

    const result = db.prepare(`
      INSERT INTO tool_assignments (tool_id, work_order_id, assigned_to, notes)
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, work_order_id || null, assigned_to || null, notes || null);

    // Mettre à jour le statut de l'outil
    db.prepare('UPDATE tools SET status = ? WHERE id = ?').run('in_use', req.params.id);

    const assignment = db.prepare(`
      SELECT ta.*, wo.number as work_order_number,
             u.first_name || ' ' || u.last_name as assigned_to_name
      FROM tool_assignments ta
      LEFT JOIN work_orders wo ON ta.work_order_id = wo.id
      LEFT JOIN users u ON ta.assigned_to = u.id
      WHERE ta.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(assignment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/tools/:id/return
router.post('/:id/return', (req, res) => {
  try {
    const { assignment_id, notes } = req.body;

    const assignment = db.prepare('SELECT * FROM tool_assignments WHERE id = ? AND returned_at IS NULL').get(assignment_id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignation non trouvée ou déjà retournée' });
    }

    db.prepare(`
      UPDATE tool_assignments
      SET returned_at = CURRENT_TIMESTAMP, notes = ?
      WHERE id = ?
    `).run(notes || null, assignment_id);

    // Mettre à jour le statut de l'outil
    db.prepare('UPDATE tools SET status = ? WHERE id = ?').run('available', req.params.id);

    res.json({ message: 'Outil retourné' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/tools/:id
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM tools WHERE id = ?').run(req.params.id);
    res.json({ message: 'Outil supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
