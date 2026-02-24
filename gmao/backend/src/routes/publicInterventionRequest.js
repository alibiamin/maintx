/**
 * API publique : formulaire de demande d'intervention (sans authentification)
 * Lié au domaine de l'application. Utilise la base client par défaut (GMAO_DEFAULT_CLIENT_DB ou gmao.db).
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const dbModule = require('../database/db');
const codification = require('../services/codification');
const notificationService = require('../services/notificationService');

const router = express.Router();

function getDefaultDb() {
  return dbModule.getDbForRequest(null);
}

/**
 * GET /api/public/equipment
 * Liste minimale des équipements (id, code, name) pour le formulaire public.
 */
router.get('/equipment', (req, res) => {
  try {
    const db = getDefaultDb();
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='equipment'").get();
    if (!hasTable) return res.json([]);
    const rows = db.prepare(`
      SELECT id, code, name FROM equipment
      ORDER BY code IS NULL OR code = '', code, name
      LIMIT 500
    `).all();
    res.json(rows.map((r) => ({ id: r.id, code: r.code || '', name: r.name || '' })));
  } catch (e) {
    console.error('[public intervention] equipment list', e);
    res.status(500).json({ error: 'Impossible de charger la liste des équipements.' });
  }
});

/**
 * POST /api/public/intervention-request
 * Créer une demande d'intervention depuis le portail public (sans login).
 * requested_by est fixé au premier utilisateur actif de la base (compte "portail").
 */
router.post('/intervention-request', [
  body('title').notEmpty().trim().isLength({ max: 500 }),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('equipmentId').optional().isInt(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('requesterName').notEmpty().trim().isLength({ max: 200 }),
  body('requesterEmail').optional().trim().isEmail(),
  body('requesterPhone').optional().trim().isLength({ max: 50 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { title, description, equipmentId, priority, requesterName, requesterEmail, requesterPhone } = req.body;

  try {
    const db = getDefaultDb();
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='intervention_requests'").get();
    if (!hasTable) return res.status(503).json({ error: 'Service temporairement indisponible.' });

    let requestedBy = null;
    try {
      const userRow = db.prepare('SELECT id FROM users WHERE is_active = 1 LIMIT 1').get();
      requestedBy = userRow ? userRow.id : null;
    } catch (_) {}
    if (requestedBy == null) return res.status(503).json({ error: 'Aucun utilisateur configuré pour recevoir les demandes.' });

    let number = null;
    try {
      number = codification.getNextCode(db, 'demande_intervention');
      if (!number || !String(number).trim()) number = null;
    } catch (_) {}

    const hasRequesterCols = db.prepare("SELECT 1 FROM pragma_table_info('intervention_requests') WHERE name='requester_name'").get();
    const priorityVal = priority || 'medium';

    let result;
    if (hasRequesterCols) {
      result = db.prepare(`
        INSERT INTO intervention_requests (number, title, description, equipment_id, requested_by, priority, status, requester_name, requester_email, requester_phone)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
      `).run(number || '', title, description || null, equipmentId || null, requestedBy, priorityVal,
        requesterName, requesterEmail || null, requesterPhone || null);
    } else {
      result = db.prepare(`
        INSERT INTO intervention_requests (number, title, description, equipment_id, requested_by, priority, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `).run(number || '', title, description || null, equipmentId || null, requestedBy, priorityVal);
    }

    const id = result.lastInsertRowid;
    if (!number) {
      const pad = (n, len) => String(n).padStart(len, '0');
      number = 'DI-' + pad(id, 4);
      try {
        db.prepare('UPDATE intervention_requests SET number = ? WHERE id = ?').run(number, id);
      } catch (_) {}
    }

    const row = db.prepare(`
      SELECT ir.*, e.name as equipment_name, e.code as equipment_code
      FROM intervention_requests ir
      LEFT JOIN equipment e ON ir.equipment_id = e.id
      WHERE ir.id = ?
    `).get(id);

    try {
      const responsibles = dbModule.getAdminDb && (() => {
        const roleNames = ['responsable_maintenance', 'administrateur'];
        const placeholders = roleNames.map(() => '?').join(',');
        try {
          return dbModule.getAdminDb().prepare(`
            SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
            WHERE u.is_active = 1 AND r.name IN (${placeholders})
          `).all(...roleNames).map((u) => u.id);
        } catch (_) { return []; }
      })() || [];
      notificationService.notify(db, 'work_order_created', responsibles, {
        number: row.number || `Demande #${id}`,
        title: `Nouvelle demande d'intervention (portail) : ${title}`,
        equipment_name: row.equipment_name ? `${row.equipment_code || ''} ${row.equipment_name}`.trim() : null,
        priority: row.priority
      }, null).catch(() => {});
    } catch (_) {}

    res.status(201).json({
      id: row.id,
      number: row.number || number,
      title: row.title,
      message: 'Votre demande a bien été enregistrée. Vous recevrez un suivi par les équipes de maintenance.'
    });
  } catch (e) {
    console.error('[public intervention] create', e);
    res.status(500).json({ error: 'Impossible d\'enregistrer la demande. Veuillez réessayer plus tard.' });
  }
});

module.exports = router;
