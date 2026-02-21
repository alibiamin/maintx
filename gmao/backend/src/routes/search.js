/**
 * API Recherche globale - équipements, OT, pièces, techniciens
 */

const express = require('express');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const LIMIT_PER_TYPE = 8;

/**
 * GET /api/search?q=...
 * Returns { equipment: [], workOrders: [], parts: [], technicians: [] }
 */
router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) {
    return res.json({ equipment: [], workOrders: [], parts: [], technicians: [] });
  }
  const pattern = `%${q}%`;

  const equipment = db.prepare(`
    SELECT id, code, name FROM equipment
    WHERE (code LIKE ? OR name LIKE ?)
    ORDER BY code LIMIT ?
  `).all(pattern, pattern, LIMIT_PER_TYPE);

  const workOrders = db.prepare(`
    SELECT wo.id, wo.number, wo.title FROM work_orders wo
    WHERE wo.number LIKE ? OR wo.title LIKE ?
    ORDER BY wo.created_at DESC LIMIT ?
  `).all(pattern, pattern, LIMIT_PER_TYPE);

  const parts = db.prepare(`
    SELECT id, code, name FROM spare_parts
    WHERE code LIKE ? OR name LIKE ?
    ORDER BY code LIMIT ?
  `).all(pattern, pattern, LIMIT_PER_TYPE);

  const technicians = db.prepare(`
    SELECT u.id, u.first_name, u.last_name, u.email
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.is_active = 1 AND r.name IN ('technicien', 'responsable_maintenance')
    AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)
    ORDER BY u.last_name, u.first_name LIMIT ?
  `).all(pattern, pattern, pattern, LIMIT_PER_TYPE);

  res.json({
    equipment: equipment.map((r) => ({ id: r.id, code: r.code, name: r.name })),
    workOrders: workOrders.map((r) => ({ id: r.id, number: r.number, title: r.title })),
    parts: parts.map((r) => ({ id: r.id, code: r.code, name: r.name })),
    technicians: technicians.map((r) => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email
    }))
  });
});

module.exports = router;
