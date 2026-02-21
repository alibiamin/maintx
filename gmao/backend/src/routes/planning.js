/**
 * API Planning global - Données pour le Gantt (préventif + correctif)
 */

const express = require('express');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/planning/gantt
 * Retourne toutes les interventions (OT + plans préventifs) dans la plage [start, end]
 * pour affichage dans un diagramme de Gantt.
 * Chaque item a: id, type (preventive|corrective), title, start, end, equipment, assigned, priority, status, etc.
 */
router.get('/gantt', (req, res) => {
  try {
    const { start, end } = req.query;
    const s = start || new Date().toISOString().split('T')[0];
    const e = end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Ordres de travail (correctifs et préventifs) dont la plage chevauche [s, e]
    const workOrders = db.prepare(`
      SELECT wo.id, wo.number, wo.title, wo.description,
             wo.planned_start, wo.planned_end, wo.created_at,
             wo.status, wo.priority, wo.assigned_to,
             wo.type_id,
             e.name as equipment_name, e.code as equipment_code,
             t.name as type_name,
             u.first_name || ' ' || u.last_name as assigned_name
      FROM work_orders wo
      LEFT JOIN equipment e ON wo.equipment_id = e.id
      LEFT JOIN work_order_types t ON wo.type_id = t.id
      LEFT JOIN users u ON wo.assigned_to = u.id
      WHERE wo.status NOT IN ('cancelled')
        AND (
          (wo.planned_start IS NOT NULL AND (
            (date(wo.planned_start) BETWEEN date(?) AND date(?))
            OR (wo.planned_end IS NOT NULL AND date(wo.planned_end) BETWEEN date(?) AND date(?))
            OR (date(wo.planned_start) <= date(?) AND (wo.planned_end IS NULL OR date(wo.planned_end) >= date(?)))
          ))
          OR (wo.planned_start IS NULL AND date(wo.created_at) BETWEEN date(?) AND date(?))
        )
      ORDER BY COALESCE(wo.planned_start, wo.created_at) ASC
    `).all(s, e, s, e, s, s, s, e);

    // Plans de maintenance préventifs (échéances dans la plage)
    const plans = db.prepare(`
      SELECT mp.id, mp.name, mp.description, mp.next_due_date, mp.frequency_days,
             e.name as equipment_name, e.code as equipment_code
      FROM maintenance_plans mp
      JOIN equipment e ON mp.equipment_id = e.id
      WHERE mp.is_active = 1
        AND date(mp.next_due_date) BETWEEN date(?) AND date(?)
      ORDER BY mp.next_due_date ASC
    `).all(s, e);

    const toDate = (str) => str ? new Date(str) : null;

    const items = [];

    workOrders.forEach(wo => {
      const plannedStart = wo.planned_start || wo.created_at;
      let startDate = toDate(plannedStart);
      let endDate = toDate(wo.planned_end) || (wo.planned_start ? toDate(wo.planned_start) : null);
      if (!endDate && startDate) {
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
      }
      if (!endDate) endDate = startDate ? new Date(startDate.getTime() + 24 * 60 * 60 * 1000) : new Date();
      const type = (wo.type_name || '').toLowerCase().includes('préventif') || (wo.type_name || '').toLowerCase().includes('preventif') ? 'preventive' : 'corrective';
      items.push({
        id: `wo-${wo.id}`,
        sourceId: wo.id,
        source: 'work_order',
        type,
        number: wo.number,
        title: wo.title,
        description: wo.description || null,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        equipment_name: wo.equipment_name,
        equipment_code: wo.equipment_code,
        assigned_name: wo.assigned_name,
        priority: wo.priority,
        status: wo.status,
        type_name: wo.type_name
      });
    });

    plans.forEach(mp => {
      const d = new Date(mp.next_due_date + 'T12:00:00');
      const endD = new Date(d);
      endD.setDate(endD.getDate() + 1);
      items.push({
        id: `plan-${mp.id}`,
        sourceId: mp.id,
        source: 'maintenance_plan',
        type: 'preventive',
        number: null,
        title: mp.name,
        description: mp.description || null,
        start: d.toISOString(),
        end: endD.toISOString(),
        equipment_name: mp.equipment_name,
        equipment_code: mp.equipment_code,
        assigned_name: null,
        priority: 'medium',
        status: 'pending',
        type_name: 'Préventif',
        plan_name: mp.name,
        frequency_days: mp.frequency_days
      });
    });

    // Tri par start
    items.sort((a, b) => new Date(a.start) - new Date(b.start));

    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/planning/assignments
 * Affectations des techniciens (OT assignés par utilisateur)
 */
router.get('/assignments', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT wo.id as work_order_id, wo.number as work_order_number, wo.title as work_order_title,
             wo.status, wo.priority, wo.planned_start, wo.planned_end,
             u.id as user_id, u.first_name || ' ' || u.last_name as technician_name,
             e.name as equipment_name, e.code as equipment_code
      FROM work_orders wo
      LEFT JOIN users u ON wo.assigned_to = u.id
      LEFT JOIN equipment e ON wo.equipment_id = e.id
      WHERE wo.status IN ('pending', 'in_progress') AND wo.assigned_to IS NOT NULL
      ORDER BY u.last_name, u.first_name, wo.planned_start
    `).all();
    res.json(rows.map(r => ({
      id: r.work_order_id,
      work_order_id: r.work_order_id,
      workOrderId: r.work_order_id,
      workOrderNumber: r.work_order_number,
      workOrderTitle: r.work_order_title,
      technicianName: r.technician_name,
      equipmentName: r.equipment_name,
      equipmentCode: r.equipment_code,
      scheduled_date: r.planned_start || r.planned_end,
      estimated_duration: null,
      status: r.status
    })));
  } catch (err) {
    if (err.message && err.message.includes('no such table')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/planning/resources
 * Ressources disponibles (techniciens, équipements) pour le planning
 */
router.get('/resources', (req, res) => {
  try {
    const technicians = db.prepare(`
      SELECT u.id, u.first_name, u.last_name, u.email,
             (SELECT COUNT(*) FROM work_orders wo WHERE wo.assigned_to = u.id AND wo.status IN ('pending', 'in_progress')) as assigned_count
      FROM users u
      INNER JOIN roles r ON u.role_id = r.id
      WHERE r.name IN ('technicien', 'responsable_maintenance') AND u.is_active = 1
      ORDER BY u.last_name, u.first_name
    `).all();
    const equipmentCount = db.prepare('SELECT COUNT(*) as total FROM equipment WHERE status != "retired"').get();
    const equipmentOperational = db.prepare('SELECT COUNT(*) as total FROM equipment WHERE status = "operational"').get();
    const woActive = db.prepare('SELECT COUNT(*) as total FROM work_orders WHERE status IN (\'pending\', \'in_progress\')').get();
    const woPending = db.prepare('SELECT COUNT(*) as total FROM work_orders WHERE status = \'pending\'').get();
    const assignedCount = technicians.reduce((s, t) => s + (t.assigned_count || 0), 0);
    res.json({
      technicians: {
        total: technicians.length,
        available: Math.max(0, technicians.length * 10 - assignedCount),
        list: technicians.map(t => ({
          ...t,
          name: `${t.first_name} ${t.last_name}`,
          status: (t.assigned_count || 0) > 0 ? 'assigned' : 'available'
        }))
      },
      equipment: {
        total: equipmentCount?.total || 0,
        operational: equipmentOperational?.total || 0
      },
      workOrders: {
        total: woActive?.total || 0,
        pending: woPending?.total || 0
      }
    });
  } catch (err) {
    if (err.message && err.message.includes('no such table')) return res.json({ technicians: { total: 0, available: 0, list: [] }, equipment: { total: 0, operational: 0 }, workOrders: { total: 0, pending: 0 } });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
