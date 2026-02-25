/**
 * API Gestion des utilisateurs (Admin)
 * Les utilisateurs sont stockés dans la base admin (gmao.db). Toutes les opérations
 * CRUD utilisent getAdminDb() et le filtrage par tenant_id pour l'isolation multi-tenant.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param, validationResult } = require('express-validator');
const { authenticate, authorize, requirePermission, ROLES } = require('../middleware/auth');
const dbModule = require('../database/db');

const router = express.Router();
router.use(authenticate);

// Liste des techniciens/responsables pour affectation OT (même tenant uniquement ; users dans gmao.db)
router.get('/assignable', requirePermission('work_orders', 'view'), (req, res) => {
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

// Rôles (base admin ; pour formulaire Création > Utilisateur)
router.get('/roles', requirePermission('users', 'view'), (req, res) => {
  const adminDb = dbModule.getAdminDb();
  const roles = adminDb.prepare('SELECT * FROM roles ORDER BY name').all();
  res.json(roles);
});

// Liste des utilisateurs : base admin uniquement, filtrée par tenant_id pour multi-tenant
router.get('/', requirePermission('users', 'view'), (req, res) => {
  const adminDb = dbModule.getAdminDb();
  const tenantId = req.tenantId;
  let rows;
  try {
    if (tenantId != null) {
      rows = adminDb.prepare(`
        SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, u.tenant_id, u.is_active, u.created_at,
          u.phone, u.address, u.city, u.postal_code, u.employee_number, u.job_title, u.department, u.hire_date, u.contract_type,
          r.name as role_name, t.name as tenant_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN tenants t ON u.tenant_id = t.id
        WHERE u.tenant_id = ?
        ORDER BY u.last_name
      `).all(tenantId);
    } else {
      rows = adminDb.prepare(`
        SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, u.tenant_id, u.is_active, u.created_at,
          u.phone, u.address, u.city, u.postal_code, u.employee_number, u.job_title, u.department, u.hire_date, u.contract_type,
          r.name as role_name, t.name as tenant_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN tenants t ON u.tenant_id = t.id
        ORDER BY u.last_name
      `).all();
    }
  } catch (e) {
    if (e.message && (e.message.includes('no such column') || e.message.includes('no such table'))) {
      const baseSql = `
        SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, u.is_active, u.created_at,
          u.phone, u.address, u.city, u.postal_code, u.employee_number, u.job_title, u.department, u.hire_date, u.contract_type,
          r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        ORDER BY u.last_name
      `;
      rows = adminDb.prepare(baseSql).all();
      rows = rows.map(r => ({ ...r, tenant_id: null, tenant_name: null }));
    } else throw e;
  }
  res.json(rows);
});

// Création utilisateur : base admin, tenant_id = req.tenantId uniquement (JWT, jamais body)
router.post('/', requirePermission('users', 'create'), [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').notEmpty(),
  body('lastName').notEmpty(),
  body('roleId').isInt()
], (req, res) => {
  const adminDb = dbModule.getAdminDb();
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const {
    email, password, firstName, lastName, roleId,
    phone, address, city, postalCode, employeeNumber, jobTitle, department, hireDate, contractType
  } = req.body;
  const tenantId = req.tenantId;
  const hash = bcrypt.hashSync(password, 10);
  try {
    let result;
    try {
      result = adminDb.prepare(`
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
        result = adminDb.prepare(`
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
    const row = adminDb.prepare(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, u.tenant_id,
        u.phone, u.address, u.city, u.postal_code, u.employee_number, u.job_title, u.department, u.hire_date, u.contract_type,
        r.name as role_name
      FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?
    `).get(result.lastInsertRowid);
    if (adminDb._save) adminDb._save();
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email deja utilise' });
    throw e;
  }
});

// Mise à jour utilisateur : base admin ; en multi-tenant, seuls les utilisateurs du même tenant sont modifiables
router.put('/:id', requirePermission('users', 'update'), param('id').isInt(), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const adminDb = dbModule.getAdminDb();
  const id = parseInt(req.params.id, 10);
  const tenantId = req.tenantId;
  const existing = adminDb.prepare('SELECT id, tenant_id FROM users WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  if (tenantId != null && existing.tenant_id !== tenantId) {
    return res.status(403).json({ error: 'Accès refusé : utilisateur d\'un autre tenant' });
  }
  const { firstName, lastName, roleId, isActive, password, phone, address, city, postalCode, employeeNumber, jobTitle, department, hireDate, contractType } = req.body;
  const updates = [];
  const values = [];
  if (firstName !== undefined) { updates.push('first_name = ?'); values.push(firstName); }
  if (lastName !== undefined) { updates.push('last_name = ?'); values.push(lastName); }
  if (roleId !== undefined) { updates.push('role_id = ?'); values.push(roleId); }
  if (isActive !== undefined) {
    updates.push('is_active = ?');
    values.push(isActive ? 1 : 0);
    try {
      if (isActive) updates.push('revoked_at = NULL');
      else updates.push("revoked_at = datetime('now')");
    } catch (_) {}
  }
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
  adminDb.prepare('UPDATE users SET ' + updates.join(', ') + ' WHERE id = ?').run(...values);
  if (adminDb._save) adminDb._save();
  const row = adminDb.prepare(`
    SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, u.is_active, u.tenant_id,
      u.phone, u.address, u.city, u.postal_code, u.employee_number, u.job_title, u.department, u.hire_date, u.contract_type,
      r.name as role_name
    FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?
  `).get(id);
  res.json(row);
});

module.exports = router;
