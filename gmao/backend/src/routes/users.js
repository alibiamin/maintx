/**
 * API Gestion des utilisateurs (Admin)
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const dbModule = require('../database/db');

const router = express.Router();
router.use(authenticate);

// Liste des techniciens/responsables pour affectation OT (même tenant uniquement ; users dans gmao.db)
router.get('/assignable', (req, res) => {
  const adminDb = dbModule.getAdminDb();
  const tenantId = req.tenantId;
  let rows;
  try {
    if (tenantId != null) {
      rows = adminDb.prepare(`
        SELECT u.id, u.first_name, u.last_name, r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.is_active = 1 AND u.tenant_id = ? AND r.name IN ('technicien', 'responsable_maintenance')
        ORDER BY u.last_name
      `).all(tenantId);
    } else {
      rows = adminDb.prepare(`
        SELECT u.id, u.first_name, u.last_name, r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.is_active = 1 AND r.name IN ('technicien', 'responsable_maintenance')
        ORDER BY u.last_name
      `).all();
    }
  } catch (e) {
    if (e.message && e.message.includes('no such column')) {
      rows = adminDb.prepare(`
        SELECT u.id, u.first_name, u.last_name, r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.is_active = 1 AND r.name IN ('technicien', 'responsable_maintenance')
        ORDER BY u.last_name
      `).all();
    } else throw e;
  }
  res.json(rows);
});

// Rôles (base admin ; accessible à tous pour le formulaire Création > Utilisateur)
router.get('/roles', (req, res) => {
  const adminDb = dbModule.getAdminDb();
  const roles = adminDb.prepare('SELECT * FROM roles ORDER BY name').all();
  res.json(roles);
});

router.use(authorize(ROLES.ADMIN));

router.get('/', (req, res) => {
  const db = req.db;
  let rows;
  try {
    rows = db.prepare(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, u.tenant_id, u.is_active, u.created_at,
        u.phone, u.address, u.city, u.postal_code, u.employee_number, u.job_title, u.department, u.hire_date, u.contract_type,
        r.name as role_name, t.name as tenant_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN tenants t ON u.tenant_id = t.id
      ORDER BY u.last_name
    `).all();
  } catch (e) {
    if (e.message && (e.message.includes('no such column') || e.message.includes('no such table'))) {
      rows = db.prepare(`
        SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, u.is_active, u.created_at,
          u.phone, u.address, u.city, u.postal_code, u.employee_number, u.job_title, u.department, u.hire_date, u.contract_type,
          r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        ORDER BY u.last_name
      `).all();
      rows = rows.map(r => ({ ...r, tenant_id: null, tenant_name: null }));
    } else throw e;
  }
  res.json(rows);
});

router.post('/', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').notEmpty(),
  body('lastName').notEmpty(),
  body('roleId').isInt(),
  body('tenantId').optional().isInt()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const {
    email, password, firstName, lastName, roleId, tenantId,
    phone, address, city, postalCode, employeeNumber, jobTitle, department, hireDate, contractType
  } = req.body;
  const hash = bcrypt.hashSync(password, 10);
  try {
    let result;
    try {
      result = db.prepare(`
        INSERT INTO users (email, password_hash, first_name, last_name, role_id, tenant_id,
          phone, address, city, postal_code, employee_number, job_title, department, hire_date, contract_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        email, hash, firstName, lastName, roleId, tenantId || null,
        phone || null, address || null, city || null, postalCode || null, employeeNumber || null,
        jobTitle || null, department || null, hireDate || null, contractType || null
      );
    } catch (colErr) {
      if (colErr.message && colErr.message.includes('no such column')) {
        result = db.prepare(`
          INSERT INTO users (email, password_hash, first_name, last_name, role_id,
            phone, address, city, postal_code, employee_number, job_title, department, hire_date, contract_type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          email, hash, firstName, lastName, roleId,
          phone || null, address || null, city || null, postalCode || null, employeeNumber || null,
          jobTitle || null, department || null, hireDate || null, contractType || null
        );
      } else throw colErr;
    }
    const row = db.prepare(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role_id,
        u.phone, u.address, u.city, u.postal_code, u.employee_number, u.job_title, u.department, u.hire_date, u.contract_type,
        r.name as role_name
      FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email deja utilise' });
    throw e;
  }
});

router.put('/:id', param('id').isInt(), (req, res) => {
  const db = req.db;
  const id = req.params.id;
  const { firstName, lastName, roleId, isActive, password, phone, address, city, postalCode, employeeNumber, jobTitle, department, hireDate, contractType } = req.body;
  const updates = [];
  const values = [];
  if (firstName !== undefined) { updates.push('first_name = ?'); values.push(firstName); }
  if (lastName !== undefined) { updates.push('last_name = ?'); values.push(lastName); }
  if (roleId !== undefined) { updates.push('role_id = ?'); values.push(roleId); }
  if (isActive !== undefined) { updates.push('is_active = ?'); values.push(isActive ? 1 : 0); }
  if (password) { updates.push('password_hash = ?'); values.push(bcrypt.hashSync(password, 10)); }
  if (phone !== undefined) { updates.push('phone = ?'); values.push(phone === '' ? null : phone); }
  if (address !== undefined) { updates.push('address = ?'); values.push(address === '' ? null : address); }
  if (city !== undefined) { updates.push('city = ?'); values.push(city === '' ? null : city); }
  if (postalCode !== undefined) { updates.push('postal_code = ?'); values.push(postalCode === '' ? null : postalCode); }
  if (employeeNumber !== undefined) { updates.push('employee_number = ?'); values.push(employeeNumber === '' ? null : employeeNumber); }
  if (jobTitle !== undefined) { updates.push('job_title = ?'); values.push(jobTitle === '' ? null : jobTitle); }
  if (department !== undefined) { updates.push('department = ?'); values.push(department === '' ? null : department); }
  if (hireDate !== undefined) { updates.push('hire_date = ?'); values.push(hireDate === '' ? null : hireDate); }
  if (contractType !== undefined) { updates.push('contract_type = ?'); values.push(contractType === '' ? null : contractType); }
  if (updates.length === 0) return res.status(400).json({ error: 'Aucune donnee' });
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  db.prepare('UPDATE users SET ' + updates.join(', ') + ' WHERE id = ?').run(...values);
  const row = db.prepare(`
    SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, u.is_active,
      u.phone, u.address, u.city, u.postal_code, u.employee_number, u.job_title, u.department, u.hire_date, u.contract_type,
      r.name as role_name
    FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?
  `).get(id);
  res.json(row);
});

module.exports = router;
