/**
 * API Techniciens : liste, compétences, évaluations, suggestion d'affectation
 * Multi-tenant : liste des utilisateurs depuis la base admin (gmao.db), filtrée par tenant pour éviter les doublons.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param, query, validationResult } = require('express-validator');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const dbModule = require('../database/db');

const router = express.Router();
router.use(authenticate);

function getTechnicianListDb(req) {
  if (req.tenantId != null) return dbModule.getClientDb(req.tenantId);
  return req.db;
}

// Créer un technicien (admin ou responsable). Multi-tenant : insertion dans la base admin avec tenant_id pour que le technicien apparaisse dans la liste.
router.post('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim()
], (req, res) => {
  const adminDb = dbModule.getAdminDb();
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });
  const {
    email, password, firstName, lastName, hourlyRate,
    phone, address, city, postalCode, employeeNumber, jobTitle, department, hireDate, contractType,
    tenantId: bodyTenantId
  } = req.body;
  const roleRow = adminDb.prepare("SELECT id FROM roles WHERE name = 'technicien'").get();
  if (!roleRow) return res.status(500).json({ error: 'Rôle technicien introuvable' });
  const hash = bcrypt.hashSync(password, 10);
  const rate = hourlyRate != null && hourlyRate !== '' ? parseFloat(String(hourlyRate).replace(',', '.')) : null;
  const tenantId = bodyTenantId != null && bodyTenantId !== '' ? parseInt(bodyTenantId, 10) : req.tenantId;
  try {
    let result;
    try {
      result = adminDb.prepare(`
        INSERT INTO users (email, password_hash, first_name, last_name, role_id, tenant_id, hourly_rate,
          phone, address, city, postal_code, employee_number, job_title, department, hire_date, contract_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        email, hash, firstName.trim(), lastName.trim(), roleRow.id, tenantId || null, rate,
        phone || null, address || null, city || null, postalCode || null, employeeNumber || null,
        jobTitle || null, department || null, hireDate || null, contractType || null
      );
    } catch (e) {
      if (e.message && e.message.includes('no such column')) {
        result = adminDb.prepare(`
          INSERT INTO users (email, password_hash, first_name, last_name, role_id, hourly_rate,
            phone, address, city, postal_code, employee_number, job_title, department, hire_date, contract_type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          email, hash, firstName.trim(), lastName.trim(), roleRow.id, rate,
          phone || null, address || null, city || null, postalCode || null, employeeNumber || null,
          jobTitle || null, department || null, hireDate || null, contractType || null
        );
      } else throw e;
    }
    const row = adminDb.prepare(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, u.hourly_rate, u.phone, u.address, u.city, u.postal_code,
        u.employee_number, u.job_title, u.department, u.hire_date, u.contract_type, r.name as role_name
      FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?
    `).get(result.lastInsertRowid);
    if (adminDb._save) adminDb._save();
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email déjà utilisé' });
    throw e;
  }
});

// Suggestion d'affectation : ?workOrderId= ou ?typeId= → techniciens triés par adéquation + note (avant /:id)
router.get('/suggest-assignment', (req, res) => {
  const db = req.db;
  const workOrderId = req.query.workOrderId ? parseInt(req.query.workOrderId) : null;
  const typeId = req.query.typeId ? parseInt(req.query.typeId) : null;

  let requiredCompetencies = [];
  if (workOrderId) {
    const wo = db.prepare('SELECT type_id FROM work_orders WHERE id = ?').get(workOrderId);
    if (wo && wo.type_id) {
      requiredCompetencies = db.prepare(`
        SELECT competence_id, required_level FROM type_competencies WHERE work_order_type_id = ?
      `).all(wo.type_id);
    }
  } else if (typeId) {
    requiredCompetencies = db.prepare(`
      SELECT competence_id, required_level FROM type_competencies WHERE work_order_type_id = ?
    `).all(typeId);
  }

  const technicians = db.prepare(`
    SELECT u.id, u.first_name, u.last_name, r.name as role_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.is_active = 1 AND r.name IN ('technicien', 'responsable_maintenance')
    ORDER BY u.last_name
  `).all();

  const techComps = db.prepare(`
    SELECT user_id, competence_id, level FROM technician_competencies
  `).all();
  const compMap = {};
  techComps.forEach(c => {
    if (!compMap[c.user_id]) compMap[c.user_id] = {};
    compMap[c.user_id][c.competence_id] = c.level;
  });

  const scores = db.prepare(`
    SELECT technician_id, AVG(score) as avg_score FROM technician_evaluations GROUP BY technician_id
  `).all();
  const scoreMap = {};
  scores.forEach(s => { scoreMap[s.technician_id] = s.avg_score; });

  const suggested = technicians.map(t => {
    let matchScore = 100;
    let matchedCount = 0;
    const totalRequired = requiredCompetencies.length;
    if (totalRequired > 0) {
      const comps = compMap[t.id] || {};
      requiredCompetencies.forEach(rc => {
        const level = comps[rc.competence_id] || 0;
        if (level >= rc.required_level) matchedCount++;
      });
      matchScore = Math.round((matchedCount / totalRequired) * 100);
    } else {
      matchScore = 50;
    }
    const evalScore = scoreMap[t.id] ? Math.round(scoreMap[t.id] * 10) / 10 : null;
    const finalScore = evalScore != null
      ? Math.round(matchScore * 0.5 + (evalScore / 5) * 50)
      : matchScore;
    return {
      id: t.id,
      first_name: t.first_name,
      last_name: t.last_name,
      role_name: t.role_name,
      match_score: Math.min(100, Math.max(0, matchScore)),
      avg_evaluation: evalScore,
      suggestion_score: Math.min(100, Math.max(0, finalScore))
    };
  });

  suggested.sort((a, b) => b.suggestion_score - a.suggestion_score);
  res.json(suggested);
});

// Liaisons type d'OT ↔ compétence (avant /:id)
router.get('/type-competencies/list', (req, res) => {
  const db = req.db;
  const rows = db.prepare(`
    SELECT tc.work_order_type_id, tc.competence_id, tc.required_level,
           t.name as type_name, c.code as competence_code, c.name as competence_name
    FROM type_competencies tc
    JOIN work_order_types t ON t.id = tc.work_order_type_id
    JOIN competencies c ON c.id = tc.competence_id
    ORDER BY t.name, c.name
  `).all();
  res.json(rows);
});

router.put('/type-competencies/save', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('links').isArray(),
  body('links.*.work_order_type_id').isInt(),
  body('links.*.competence_id').isInt(),
  body('links.*.required_level').isInt({ min: 1, max: 5 })
], (req, res) => {
  const db = req.db;
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });
  const { links } = req.body;
  db.prepare('DELETE FROM type_competencies').run();
  (links || []).forEach(({ work_order_type_id, competence_id, required_level }) => {
    db.prepare(`
      INSERT INTO type_competencies (work_order_type_id, competence_id, required_level) VALUES (?, ?, ?)
    `).run(work_order_type_id, competence_id, required_level);
  });
  const rows = db.prepare(`
    SELECT tc.work_order_type_id, tc.competence_id, tc.required_level,
           t.name as type_name, c.code as competence_code, c.name as competence_name
    FROM type_competencies tc
    JOIN work_order_types t ON t.id = tc.work_order_type_id
    JOIN competencies c ON c.id = tc.competence_id
    ORDER BY t.name, c.name
  `).all();
  res.json(rows);
});

// Liste des techniciens (et responsables) avec compétences, note moyenne et taux horaire
// Chaque base (tenant) ne voit que ses techniciens : filtre strict par req.tenantId (pas de combo client).
// Admin (tenantId null) : uniquement les techniciens sans client (tenant_id IS NULL).
// Query: page (1-based), limit (default 20). With pagination: response { data: [...], total: N }
router.get('/', (req, res) => {
  const adminDb = dbModule.getAdminDb();
  const { page, limit } = req.query;
  const usePagination = page !== undefined && page !== '';
  const limitNum = usePagination ? Math.min(parseInt(limit, 10) || 20, 100) : 1e6;
  const offset = usePagination ? ((parseInt(page, 10) || 1) - 1) * limitNum : 0;

  let countSql;
  let listSql;
  let countParams = [];
  let listParams = [];
  try {
    if (req.tenantId != null) {
      countSql = `
        SELECT COUNT(*) as total FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.is_active = 1 AND u.tenant_id = ? AND r.name IN ('technicien', 'responsable_maintenance')
      `;
      listSql = `
        SELECT u.id, u.first_name, u.last_name, u.email, u.hourly_rate, u.manager_id,
          u.phone, u.address, u.city, u.postal_code, u.employee_number, u.job_title, u.department, u.hire_date, u.contract_type,
          r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.is_active = 1 AND u.tenant_id = ? AND r.name IN ('technicien', 'responsable_maintenance')
        ORDER BY u.last_name, u.first_name
        LIMIT ? OFFSET ?
      `;
      countParams = [req.tenantId];
      listParams = [req.tenantId, limitNum, offset];
    } else {
      countSql = `
        SELECT COUNT(*) as total FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.is_active = 1 AND (u.tenant_id IS NULL OR u.tenant_id = 0) AND r.name IN ('technicien', 'responsable_maintenance')
      `;
      listSql = `
        SELECT u.id, u.first_name, u.last_name, u.email, u.hourly_rate, u.manager_id,
          u.phone, u.address, u.city, u.postal_code, u.employee_number, u.job_title, u.department, u.hire_date, u.contract_type,
          r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.is_active = 1 AND (u.tenant_id IS NULL OR u.tenant_id = 0) AND r.name IN ('technicien', 'responsable_maintenance')
        ORDER BY u.last_name, u.first_name
        LIMIT ? OFFSET ?
      `;
      listParams = [limitNum, offset];
    }
  } catch (e) {
    if (!e.message || !e.message.includes('no such column')) throw e;
    countSql = `
      SELECT COUNT(*) as total FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = 1 AND r.name IN ('technicien', 'responsable_maintenance')
    `;
    listSql = `
      SELECT u.id, u.first_name, u.last_name, u.email, u.hourly_rate, u.manager_id,
        u.phone, u.address, u.city, u.postal_code, u.employee_number, u.job_title, u.department, u.hire_date, u.contract_type,
        r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = 1 AND r.name IN ('technicien', 'responsable_maintenance')
      ORDER BY u.last_name, u.first_name
      LIMIT ? OFFSET ?
    `;
    listParams = [limitNum, offset];
  }

  const total = countParams.length ? (adminDb.prepare(countSql).get(...countParams)?.total ?? 0) : (adminDb.prepare(countSql).get()?.total ?? 0);
  let users;
  try {
    users = listParams.length ? adminDb.prepare(listSql).all(...listParams) : adminDb.prepare(listSql).all(limitNum, offset);
  } catch (e) {
    if (e.message && (e.message.includes('no such table') || e.message.includes('no such column'))) {
      const fallback = `
        SELECT u.id, u.first_name, u.last_name, u.email, u.hourly_rate, u.manager_id,
          u.phone, u.address, u.city, u.postal_code, u.employee_number, u.job_title, u.department, u.hire_date, u.contract_type,
          r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.is_active = 1 AND r.name IN ('technicien', 'responsable_maintenance')
        ORDER BY u.last_name, u.first_name
        LIMIT ? OFFSET ?
      `;
      users = adminDb.prepare(fallback).all(limitNum, offset);
    } else throw e;
  }

  const dataDb = getTechnicianListDb(req);
  let competencies = [];
  let scores = [];
  let workloadByUser = {};
  try {
    competencies = dataDb.prepare(`
      SELECT tc.user_id, tc.competence_id, tc.level, c.code, c.name
      FROM technician_competencies tc
      JOIN competencies c ON c.id = tc.competence_id
    `).all();
    scores = dataDb.prepare(`
      SELECT technician_id, AVG(score) as avg_score, COUNT(*) as evaluation_count
      FROM technician_evaluations
      GROUP BY technician_id
    `).all();
    const workloadRows = dataDb.prepare(`
      SELECT assigned_to as user_id, COUNT(*) as count
      FROM work_orders
      WHERE status IN ('pending', 'in_progress') AND assigned_to IS NOT NULL
      GROUP BY assigned_to
    `).all();
    workloadRows.forEach((r) => { workloadByUser[r.user_id] = r.count; });
  } catch (e) {
    if (!e.message || (!e.message.includes('no such table') && !e.message.includes('no such column'))) throw e;
  }

  const byUser = {};
  competencies.forEach(c => {
    if (!byUser[c.user_id]) byUser[c.user_id] = [];
    byUser[c.user_id].push({ competence_id: c.competence_id, code: c.code, name: c.name, level: c.level });
  });
  const scoreByUser = {};
  scores.forEach(s => {
    scoreByUser[s.technician_id] = { avg_score: Math.round(s.avg_score * 10) / 10, evaluation_count: s.evaluation_count };
  });

  const list = users.map(u => ({
    id: u.id,
    first_name: u.first_name,
    last_name: u.last_name,
    email: u.email,
    hourly_rate: u.hourly_rate != null ? parseFloat(u.hourly_rate) : null,
    manager_id: u.manager_id || null,
    role_name: u.role_name,
    tenant_name: u.tenant_name || null,
    phone: u.phone || null,
    address: u.address || null,
    city: u.city || null,
    postal_code: u.postal_code || null,
    employee_number: u.employee_number || null,
    job_title: u.job_title || null,
    department: u.department || null,
    hire_date: u.hire_date || null,
    contract_type: u.contract_type || null,
    competencies: byUser[u.id] || [],
    avg_score: scoreByUser[u.id]?.avg_score ?? null,
    evaluation_count: scoreByUser[u.id]?.evaluation_count ?? 0,
    workload_count: workloadByUser[u.id] ?? 0
  }));

  if (usePagination) {
    res.json({ data: list, total });
  } else {
    res.json(list);
  }
});

// Hiérarchie équipe (tree) — avant /:id
router.get('/team-hierarchy', (req, res) => {
  const db = req.db;
  const rows = db.prepare(`
    SELECT u.id, u.first_name, u.last_name, u.manager_id, r.name as role_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.is_active = 1 AND r.name IN ('technicien', 'responsable_maintenance')
    ORDER BY u.last_name, u.first_name
  `).all();
  const byId = {};
  rows.forEach(r => {
    byId[r.id] = {
      id: r.id,
      label: `${r.first_name} ${r.last_name}`,
      role_name: r.role_name,
      manager_id: r.manager_id || null,
      children: []
    };
  });
  const roots = [];
  rows.forEach(r => {
    const node = byId[r.id];
    if (!r.manager_id || !byId[r.manager_id]) {
      roots.push(node);
    } else {
      byId[r.manager_id].children.push(node);
    }
  });
  res.json(roots);
});

// Détail d'un technicien + compétences + évaluations. Utilisateur depuis la base admin ; compétences/évaluations depuis la base client.
router.get('/:id', param('id').isInt(), (req, res) => {
  const adminDb = dbModule.getAdminDb();
  const dataDb = getTechnicianListDb(req);
  const id = parseInt(req.params.id);
  let user;
  try {
    user = adminDb.prepare(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.is_active, u.hourly_rate, u.manager_id,
        u.phone, u.address, u.city, u.postal_code, u.employee_number, u.job_title, u.department, u.hire_date, u.contract_type,
        r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND r.name IN ('technicien', 'responsable_maintenance')
    `).get(id);
    if (user && req.tenantId != null) {
      const withTenant = adminDb.prepare('SELECT tenant_id FROM users WHERE id = ?').get(id);
      if (withTenant && withTenant.tenant_id !== req.tenantId) return res.status(404).json({ error: 'Technicien introuvable' });
    }
  } catch (e) {
    if (e.message && e.message.includes('no such column')) user = null;
    else throw e;
  }
  if (!user) return res.status(404).json({ error: 'Technicien introuvable' });
  if (user.hourly_rate != null) user.hourly_rate = parseFloat(user.hourly_rate);
  let comps = []; let evals = []; let scoreRow = null;
  try {
    comps = dataDb.prepare(`
      SELECT tc.competence_id, tc.level, c.code, c.name
      FROM technician_competencies tc
      JOIN competencies c ON c.id = tc.competence_id
      WHERE tc.user_id = ?
    `).all(id);
    evals = dataDb.prepare(`
      SELECT e.id, e.technician_id, e.evaluator_id, e.work_order_id, e.score, e.comment, e.created_at,
             ev.first_name || ' ' || ev.last_name as evaluator_name,
             wo.number as work_order_number, wo.title as work_order_title
      FROM technician_evaluations e
      JOIN users ev ON ev.id = e.evaluator_id
      LEFT JOIN work_orders wo ON wo.id = e.work_order_id
      WHERE e.technician_id = ?
      ORDER BY e.created_at DESC
    `).all(id);
    scoreRow = dataDb.prepare(`
      SELECT AVG(score) as avg_score, COUNT(*) as evaluation_count FROM technician_evaluations WHERE technician_id = ?
    `).get(id);
  } catch (_) { /* tables may be in another db */ }
  let trainings = [];
  try {
    trainings = dataDb.prepare(`
      SELECT id, name, description, completed_date, valid_until, issuer, created_at
      FROM technician_trainings WHERE technician_id = ? ORDER BY (valid_until IS NULL), valid_until DESC, (completed_date IS NULL), completed_date DESC
    `).all(id);
  } catch (_) { /* table may not exist yet */ }
  res.json({
    ...user,
    competencies: comps,
    evaluations: evals,
    trainings,
    avg_score: scoreRow?.avg_score ? Math.round(scoreRow.avg_score * 10) / 10 : null,
    evaluation_count: scoreRow?.evaluation_count ?? 0
  });
});

// Mise à jour du profil technicien (taux horaire, nom, prénom)
router.put('/:id', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt(),
  body('hourlyRate').optional()
], (req, res) => {
  const db = req.db;
  const id = parseInt(req.params.id);
  const existing = db.prepare(`
    SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.id = ? AND r.name IN ('technicien', 'responsable_maintenance')
  `).get(id);
  if (!existing) return res.status(404).json({ error: 'Technicien introuvable' });
  const { hourlyRate, firstName, lastName, managerId, phone, address, city, postalCode, employeeNumber, jobTitle, department, hireDate, contractType } = req.body;
  const updates = [];
  const values = [];
  if (hourlyRate !== undefined) {
    const v = hourlyRate === null || hourlyRate === '' ? null : parseFloat(String(hourlyRate).replace(',', '.'));
    updates.push('hourly_rate = ?');
    values.push(v);
  }
  if (managerId !== undefined) {
    const mid = managerId === null || managerId === '' ? null : parseInt(managerId, 10);
    if (mid === id) return res.status(400).json({ error: 'Un technicien ne peut pas être son propre responsable' });
    updates.push('manager_id = ?');
    values.push(mid);
  }
  if (firstName !== undefined && firstName !== '') {
    updates.push('first_name = ?');
    values.push(String(firstName).trim());
  }
  if (lastName !== undefined && lastName !== '') {
    updates.push('last_name = ?');
    values.push(String(lastName).trim());
  }
  if (phone !== undefined) { updates.push('phone = ?'); values.push(phone === '' ? null : phone); }
  if (address !== undefined) { updates.push('address = ?'); values.push(address === '' ? null : address); }
  if (city !== undefined) { updates.push('city = ?'); values.push(city === '' ? null : city); }
  if (postalCode !== undefined) { updates.push('postal_code = ?'); values.push(postalCode === '' ? null : postalCode); }
  if (employeeNumber !== undefined) { updates.push('employee_number = ?'); values.push(employeeNumber === '' ? null : employeeNumber); }
  if (jobTitle !== undefined) { updates.push('job_title = ?'); values.push(jobTitle === '' ? null : jobTitle); }
  if (department !== undefined) { updates.push('department = ?'); values.push(department === '' ? null : department); }
  if (hireDate !== undefined) { updates.push('hire_date = ?'); values.push(hireDate === '' ? null : hireDate); }
  if (contractType !== undefined) { updates.push('contract_type = ?'); values.push(contractType === '' ? null : contractType); }
  const selectUser = () => db.prepare(`
    SELECT u.id, u.first_name, u.last_name, u.email, u.hourly_rate, u.manager_id,
      u.phone, u.address, u.city, u.postal_code, u.employee_number, u.job_title, u.department, u.hire_date, u.contract_type,
      r.name as role_name
    FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?
  `).get(id);
  if (updates.length === 0) {
    const u = selectUser();
    if (u?.hourly_rate != null) u.hourly_rate = parseFloat(u.hourly_rate);
    return res.json(u);
  }
  values.push(id);
  db.prepare(`UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
  const u = selectUser();
  if (u?.hourly_rate != null) u.hourly_rate = parseFloat(u.hourly_rate);
  res.json(u);
});

// Mise à jour des compétences d'un technicien
router.put('/:id/competencies', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt(),
  body('competencies').isArray(),
  body('competencies.*.competence_id').isInt(),
  body('competencies.*.level').isInt({ min: 1, max: 5 })
], (req, res) => {
  const db = req.db;
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });
  const id = parseInt(req.params.id);
  const { competencies } = req.body;
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Technicien introuvable' });

  db.prepare('DELETE FROM technician_competencies WHERE user_id = ?').run(id);
  competencies.forEach(({ competence_id, level }) => {
    db.prepare(`
      INSERT INTO technician_competencies (user_id, competence_id, level) VALUES (?, ?, ?)
    `).run(id, competence_id, Math.min(5, Math.max(1, level)));
  });
  const updated = db.prepare(`
    SELECT tc.competence_id, tc.level, c.code, c.name
    FROM technician_competencies tc
    JOIN competencies c ON c.id = tc.competence_id
    WHERE tc.user_id = ?
  `).all(id);
  res.json(updated);
});

// Liste des évaluations d'un technicien
router.get('/:id/evaluations', param('id').isInt(), (req, res) => {
  const db = req.db;
  const id = parseInt(req.params.id);
  const rows = db.prepare(`
    SELECT e.id, e.score, e.comment, e.created_at, e.work_order_id,
           ev.first_name || ' ' || ev.last_name as evaluator_name,
           wo.number as work_order_number, wo.title as work_order_title
    FROM technician_evaluations e
    JOIN users ev ON ev.id = e.evaluator_id
    LEFT JOIN work_orders wo ON wo.id = e.work_order_id
    WHERE e.technician_id = ?
    ORDER BY e.created_at DESC
  `).all(id);
  res.json(rows);
});

// Ajouter une évaluation. Stockée dans la base client du technicien (tenant_id) pour cohérence multi-tenant.
router.post('/:id/evaluations', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt(),
  body('score').isInt({ min: 1, max: 5 }),
  body('comment').optional().trim(),
  body('work_order_id').optional().isInt()
], (req, res) => {
  const adminDb = dbModule.getAdminDb();
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });
  const technicianId = parseInt(req.params.id);
  const { score, comment, work_order_id } = req.body;
  const evaluatorId = req.user.id;
  const tech = adminDb.prepare('SELECT id, tenant_id FROM users WHERE id = ?').get(technicianId);
  if (!tech) return res.status(404).json({ error: 'Technicien introuvable' });
  const dataDb = tech.tenant_id != null ? dbModule.getClientDb(tech.tenant_id) : getTechnicianListDb(req);

  try {
    dataDb.prepare(`
      INSERT INTO technician_evaluations (technician_id, evaluator_id, work_order_id, score, comment)
      VALUES (?, ?, ?, ?, ?)
    `).run(technicianId, evaluatorId, work_order_id || null, score, comment || null);
    if (dataDb._save) dataDb._save();
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(501).json({ error: 'Table évaluations absente sur la base du client.' });
    throw e;
  }
  const row = dataDb.prepare(`
    SELECT e.id, e.technician_id, e.evaluator_id, e.work_order_id, e.score, e.comment, e.created_at
    FROM technician_evaluations e WHERE e.technician_id = ? ORDER BY e.created_at DESC LIMIT 1
  `).get(technicianId);
  res.status(201).json(row);
});

// ————— Formations / habilitations (avec date de validité) —————
router.get('/:id/trainings', param('id').isInt(), (req, res) => {
  const db = req.db;
  const id = parseInt(req.params.id);
  const user = db.prepare(`
    SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.id = ? AND r.name IN ('technicien', 'responsable_maintenance')
  `).get(id);
  if (!user) return res.status(404).json({ error: 'Technicien introuvable' });
  try {
    const rows = db.prepare(`
      SELECT id, name, description, completed_date, valid_until, issuer, created_at
      FROM technician_trainings WHERE technician_id = ? ORDER BY (valid_until IS NULL), valid_until DESC, (completed_date IS NULL), completed_date DESC
    `).all(id);
    res.json(rows);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});

router.post('/:id/trainings', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt(),
  body('name').notEmpty().trim(),
  body('description').optional().trim(),
  body('completed_date').optional().isDate(),
  body('valid_until').optional().isDate(),
  body('issuer').optional().trim()
], (req, res) => {
  const db = req.db;
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });
  const technicianId = parseInt(req.params.id);
  const { name, description, completed_date, valid_until, issuer } = req.body;
  const tech = db.prepare(`
    SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
    WHERE u.id = ? AND r.name IN ('technicien', 'responsable_maintenance')
  `).get(technicianId);
  if (!tech) return res.status(404).json({ error: 'Technicien introuvable' });
  try {
    db.prepare(`
      INSERT INTO technician_trainings (technician_id, name, description, completed_date, valid_until, issuer)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(technicianId, name.trim(), description || null, completed_date || null, valid_until || null, issuer || null);
    const row = db.prepare(`
      SELECT id, name, description, completed_date, valid_until, issuer, created_at
      FROM technician_trainings WHERE technician_id = ? ORDER BY id DESC LIMIT 1
    `).get(technicianId);
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.status(501).json({ error: 'Table technician_trainings absente. Exécutez les migrations.' });
    throw e;
  }
});

router.put('/:id/trainings/:tid', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt(),
  param('tid').isInt(),
  body('name').optional().notEmpty().trim(),
  body('description').optional().trim(),
  body('completed_date').optional().isDate(),
  body('valid_until').optional().isDate(),
  body('issuer').optional().trim()
], (req, res) => {
  const db = req.db;
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });
  const technicianId = parseInt(req.params.id);
  const tid = parseInt(req.params.tid);
  const tech = db.prepare('SELECT id FROM users WHERE id = ?').get(technicianId);
  if (!tech) return res.status(404).json({ error: 'Technicien introuvable' });
  const existing = db.prepare('SELECT id FROM technician_trainings WHERE id = ? AND technician_id = ?').get(tid, technicianId);
  if (!existing) return res.status(404).json({ error: 'Formation introuvable' });
  const { name, description, completed_date, valid_until, issuer } = req.body;
  const updates = [];
  const values = [];
  if (name !== undefined) { updates.push('name = ?'); values.push(name.trim()); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description || null); }
  if (completed_date !== undefined) { updates.push('completed_date = ?'); values.push(completed_date || null); }
  if (valid_until !== undefined) { updates.push('valid_until = ?'); values.push(valid_until || null); }
  if (issuer !== undefined) { updates.push('issuer = ?'); values.push(issuer || null); }
  if (updates.length === 0) {
    const row = db.prepare('SELECT id, name, description, completed_date, valid_until, issuer, created_at FROM technician_trainings WHERE id = ?').get(tid);
    return res.json(row);
  }
  values.push(tid);
  db.prepare(`UPDATE technician_trainings SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
  const row = db.prepare('SELECT id, name, description, completed_date, valid_until, issuer, created_at FROM technician_trainings WHERE id = ?').get(tid);
  res.json(row);
});

router.delete('/:id/trainings/:tid', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt(),
  param('tid').isInt()
], (req, res) => {
  const db = req.db;
  const technicianId = parseInt(req.params.id);
  const tid = parseInt(req.params.tid);
  const existing = db.prepare('SELECT id FROM technician_trainings WHERE id = ? AND technician_id = ?').get(tid, technicianId);
  if (!existing) return res.status(404).json({ error: 'Formation introuvable' });
  db.prepare('DELETE FROM technician_trainings WHERE id = ?').run(tid);
  res.status(204).send();
});

module.exports = router;
