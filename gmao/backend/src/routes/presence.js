/**
 * API Présence - synthèse par date (qui est présent, congés, heures pointées)
 * Combine time_entries et attendance_overrides. Données en base client.
 */
const express = require('express');
const { query, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const dbModule = require('../database/db');

const router = express.Router();
router.use(authenticate);

function getTechniciansForTenant(adminDb, tenantId) {
  if (tenantId != null) {
    return adminDb.prepare(`
      SELECT u.id, u.first_name, u.last_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = 1 AND u.tenant_id = ? AND r.name IN ('technicien', 'responsable_maintenance')
      ORDER BY u.last_name, u.first_name
    `).all(tenantId);
  }
  // Démo (tenantId null) : techniciens sans client (tenant_id IS NULL)
  return adminDb.prepare(`
    SELECT u.id, u.first_name, u.last_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.is_active = 1 AND (u.tenant_id IS NULL OR u.tenant_id = 0) AND r.name IN ('technicien', 'responsable_maintenance')
    ORDER BY u.last_name, u.first_name
  `).all();
}

/**
 * GET /api/presence/summary?date=YYYY-MM-DD
 * Retourne pour chaque technicien du tenant : status (present|absent|leave|training|sick|other), firstIn, lastOut, minutesWorked (si présent)
 */
router.get('/summary', [
  query('date').notEmpty().trim().isISO8601()
], (req, res) => {
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });

  const dateStr = req.query.date.trim().slice(0, 10);
  const dateStart = dateStr + 'T00:00:00.000';
  const dateEnd = dateStr + 'T23:59:59.999';

  const adminDb = dbModule.getAdminDb();
  const technicians = getTechniciansForTenant(adminDb, req.tenantId);
  if (technicians.length === 0) {
    return res.json({ date: dateStr, items: [] });
  }

  const db = req.db;
  let overrides = [];
  let entries = [];
  try {
    const ids = technicians.map((t) => t.id);
    const placeholders = ids.map(() => '?').join(',');
    overrides = db.prepare(
      `SELECT technician_id, status, comment FROM attendance_overrides WHERE date = ? AND technician_id IN (${placeholders})`
    ).all(dateStr, ...ids);
    entries = db.prepare(
      `SELECT technician_id, occurred_at, type FROM time_entries WHERE occurred_at >= ? AND occurred_at <= ? AND technician_id IN (${placeholders}) ORDER BY occurred_at`
    ).all(dateStart, dateEnd, ...ids);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) {
      return res.json({ date: dateStr, items: technicians.map((t) => ({
        technician_id: t.id,
        technician_first_name: t.first_name,
        technician_last_name: t.last_name,
        status: 'absent',
        first_in: null,
        last_out: null,
        minutes_worked: null,
        override_comment: null
      })) });
    }
    throw e;
  }

  const overrideByTech = Object.fromEntries(overrides.map((o) => [o.technician_id, o]));
  const entriesByTech = {};
  for (const e of entries) {
    if (!entriesByTech[e.technician_id]) entriesByTech[e.technician_id] = [];
    entriesByTech[e.technician_id].push({ occurred_at: e.occurred_at, type: e.type });
  }

  function computeMinutes(evts) {
    if (!evts || evts.length < 2) return null;
    let firstIn = null;
    let lastOut = null;
    for (const e of evts) {
      if (e.type === 'in') firstIn = firstIn == null || e.occurred_at < firstIn ? e.occurred_at : firstIn;
      if (e.type === 'out') lastOut = lastOut == null || e.occurred_at > lastOut ? e.occurred_at : lastOut;
    }
    if (firstIn == null || lastOut == null || firstIn >= lastOut) return { firstIn: null, lastOut: null, minutes: null };
    const minutes = Math.round((new Date(lastOut) - new Date(firstIn)) / 60000);
    return { firstIn, lastOut, minutes };
  }

  const items = technicians.map((t) => {
    const override = overrideByTech[t.id];
    const evts = entriesByTech[t.id] || [];
    const computed = computeMinutes(evts);

    let status = 'absent';
    if (override) {
      status = override.status;
    } else if (evts.length > 0) {
      const hasIn = evts.some((e) => e.type === 'in');
      const hasOut = evts.some((e) => e.type === 'out');
      status = hasIn && (hasOut || evts.filter((e) => e.type === 'in').length > evts.filter((e) => e.type === 'out').length) ? 'present' : 'present';
    }

    return {
      technician_id: t.id,
      technician_first_name: t.first_name,
      technician_last_name: t.last_name,
      status,
      first_in: computed?.firstIn ?? null,
      last_out: computed?.lastOut ?? null,
      minutes_worked: computed?.minutes ?? null,
      override_comment: override?.comment ?? null
    };
  });

  res.json({ date: dateStr, items });
});

module.exports = router;
