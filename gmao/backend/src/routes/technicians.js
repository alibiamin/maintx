/**
 * API Techniciens : liste, compétences, évaluations, suggestion d'affectation
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param, query, validationResult } = require('express-validator');
const db = require('../database/db');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Créer un technicien (admin ou responsable)
router.post('/', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim()
], (req, res) => {
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });
  const { email, password, firstName, lastName } = req.body;
  const roleRow = db.prepare("SELECT id FROM roles WHERE name = 'technicien'").get();
  if (!roleRow) return res.status(500).json({ error: 'Rôle technicien introuvable' });
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare(`
      INSERT INTO users (email, password_hash, first_name, last_name, role_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(email, hash, firstName.trim(), lastName.trim(), roleRow.id);
    const row = db.prepare(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, r.name as role_name
      FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email déjà utilisé' });
    throw e;
  }
});

// Suggestion d'affectation : ?workOrderId= ou ?typeId= → techniciens triés par adéquation + note (avant /:id)
router.get('/suggest-assignment', (req, res) => {
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

// Liste des techniciens (et responsables) avec compétences et note moyenne
router.get('/', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.first_name, u.last_name, u.email, r.name as role_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.is_active = 1 AND r.name IN ('technicien', 'responsable_maintenance')
    ORDER BY u.last_name, u.first_name
  `).all();

  const competencies = db.prepare(`
    SELECT tc.user_id, tc.competence_id, tc.level, c.code, c.name
    FROM technician_competencies tc
    JOIN competencies c ON c.id = tc.competence_id
  `).all();

  const scores = db.prepare(`
    SELECT technician_id, AVG(score) as avg_score, COUNT(*) as evaluation_count
    FROM technician_evaluations
    GROUP BY technician_id
  `).all();

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
    role_name: u.role_name,
    competencies: byUser[u.id] || [],
    avg_score: scoreByUser[u.id]?.avg_score ?? null,
    evaluation_count: scoreByUser[u.id]?.evaluation_count ?? 0
  }));
  res.json(list);
});

// Détail d'un technicien + compétences + évaluations
router.get('/:id', param('id').isInt(), (req, res) => {
  const id = parseInt(req.params.id);
  const user = db.prepare(`
    SELECT u.id, u.first_name, u.last_name, u.email, u.is_active, r.name as role_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = ? AND r.name IN ('technicien', 'responsable_maintenance')
  `).get(id);
  if (!user) return res.status(404).json({ error: 'Technicien introuvable' });
  const comps = db.prepare(`
    SELECT tc.competence_id, tc.level, c.code, c.name
    FROM technician_competencies tc
    JOIN competencies c ON c.id = tc.competence_id
    WHERE tc.user_id = ?
  `).all(id);
  const evals = db.prepare(`
    SELECT e.id, e.technician_id, e.evaluator_id, e.work_order_id, e.score, e.comment, e.created_at,
           ev.first_name || ' ' || ev.last_name as evaluator_name,
           wo.number as work_order_number, wo.title as work_order_title
    FROM technician_evaluations e
    JOIN users ev ON ev.id = e.evaluator_id
    LEFT JOIN work_orders wo ON wo.id = e.work_order_id
    WHERE e.technician_id = ?
    ORDER BY e.created_at DESC
  `).all(id);
  const scoreRow = db.prepare(`
    SELECT AVG(score) as avg_score, COUNT(*) as evaluation_count FROM technician_evaluations WHERE technician_id = ?
  `).get(id);
  res.json({
    ...user,
    competencies: comps,
    evaluations: evals,
    avg_score: scoreRow?.avg_score ? Math.round(scoreRow.avg_score * 10) / 10 : null,
    evaluation_count: scoreRow?.evaluation_count ?? 0
  });
});

// Mise à jour des compétences d'un technicien
router.put('/:id/competencies', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt(),
  body('competencies').isArray(),
  body('competencies.*.competence_id').isInt(),
  body('competencies.*.level').isInt({ min: 1, max: 5 })
], (req, res) => {
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

// Ajouter une évaluation
router.post('/:id/evaluations', authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  param('id').isInt(),
  body('score').isInt({ min: 1, max: 5 }),
  body('comment').optional().trim(),
  body('work_order_id').optional().isInt()
], (req, res) => {
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });
  const technicianId = parseInt(req.params.id);
  const { score, comment, work_order_id } = req.body;
  const evaluatorId = req.user.id;
  const tech = db.prepare('SELECT id FROM users WHERE id = ?').get(technicianId);
  if (!tech) return res.status(404).json({ error: 'Technicien introuvable' });

  db.prepare(`
    INSERT INTO technician_evaluations (technician_id, evaluator_id, work_order_id, score, comment)
    VALUES (?, ?, ?, ?, ?)
  `).run(technicianId, evaluatorId, work_order_id || null, score, comment || null);
  const row = db.prepare(`
    SELECT e.id, e.technician_id, e.evaluator_id, e.work_order_id, e.score, e.comment, e.created_at
    FROM technician_evaluations e WHERE e.technician_id = ? ORDER BY e.created_at DESC LIMIT 1
  `).get(technicianId);
  res.status(201).json(row);
});

module.exports = router;
