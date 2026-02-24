/**
 * Routes d'authentification - Login, profil
 * Tous les utilisateurs (admins MAINTX + clients) sont dans gmao.db.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const dbModule = require('../database/db');
const { authenticate, JWT_SECRET, ROLES } = require('../middleware/auth');

const router = express.Router();
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '24h';

const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_MAX = parseInt(process.env.LOGIN_RATE_MAX, 10) || 10;
const loginAttempts = new Map();

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
}

function isLoginRateLimited(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  let entry = loginAttempts.get(ip);
  if (!entry) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_RATE_WINDOW_MS });
    return false;
  }
  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + LOGIN_RATE_WINDOW_MS;
    return false;
  }
  entry.count += 1;
  if (entry.count > LOGIN_RATE_MAX) {
    return true;
  }
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts.entries()) {
    if (now > entry.resetAt) loginAttempts.delete(ip);
  }
}, 60000);

/**
 * POST /api/auth/login
 * Connexion : base déterminée par l'email (admin xmaint ou base client selon domaine).
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], (req, res) => {
  try {
    if (isLoginRateLimited(req)) {
      return res.status(429).json({ error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();
    const resolved = dbModule.resolveTenantByEmail(normalizedEmail);
    if (!resolved) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    const mainDb = dbModule.getAdminDb();
    const user = mainDb.prepare(`
      SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.role_id, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE LOWER(TRIM(u.email)) = ? AND u.is_active = 1
    `).get(normalizedEmail);
    const tenantId = resolved.isAdmin ? null : resolved.tenantId;
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    let passwordOk = false;
    try {
      passwordOk = bcrypt.compareSync(password, user.password_hash || '');
    } catch (e) {
      console.error('[auth/login] bcrypt.compareSync error:', e.message);
      return res.status(500).json({ error: 'Erreur de vérification du mot de passe. Contactez l\'administrateur.' });
    }
    if (!passwordOk) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    if (tenantId != null) {
      let tenant;
      try {
        tenant = mainDb.prepare('SELECT id, license_start, license_end FROM tenants WHERE id = ?').get(tenantId);
      } catch (e) {
        if (e.message && e.message.includes('no such table')) tenant = null;
        else throw e;
      }
      if (!tenant) {
        return res.status(403).json({
          error: 'Compte client désactivé ou supprimé. Contactez l\'administrateur.',
          code: 'TENANT_INVALID'
        });
      }
      const today = new Date().toISOString().slice(0, 10);
      if (tenant.license_end && String(tenant.license_end).trim() && today > tenant.license_end) {
        return res.status(403).json({ error: 'Licence expirée. Contactez l\'administrateur pour une nouvelle activation.', code: 'LICENSE_EXPIRED' });
      }
      if (tenant.license_start && String(tenant.license_start).trim() && today < tenant.license_start) {
        return res.status(403).json({ error: 'Licence pas encore active. La date de début d\'utilisation n\'est pas encore atteinte.', code: 'LICENSE_NOT_ACTIVE' });
      }
    }
    const token = jwt.sign(
      { userId: user.id, role: user.role_name, tenantId },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role_name
      },
      tenantId: tenantId ?? undefined
    });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({
      error: 'Erreur serveur lors de la connexion',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * GET /api/auth/me
 * Profil utilisateur courant. Tous les utilisateurs sont dans gmao.db → on lit toujours la base admin.
 */
router.get('/me', authenticate, (req, res) => {
  const mainDb = dbModule.getAdminDb();
  const row = mainDb.prepare(`
    SELECT id, email, first_name, last_name, pinned_menu_items, dashboard_layout
    FROM users WHERE id = ?
  `).get(req.user.id);
  if (!row) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  let pinnedMenuItems = [];
  try {
    if (row.pinned_menu_items) {
      const parsed = JSON.parse(row.pinned_menu_items);
      pinnedMenuItems = Array.isArray(parsed) ? parsed : [];
    }
  } catch (_) {}
  let dashboardLayout = null;
  try {
    if (row.dashboard_layout) {
      const parsed = JSON.parse(row.dashboard_layout);
      dashboardLayout = Array.isArray(parsed) ? parsed : null;
    }
  } catch (_) {}
  res.json({
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: req.user.role_name,
    pinnedMenuItems,
    dashboardLayout,
    isAdmin: req.tenantId == null
  });
});

/**
 * PUT /api/auth/me
 * Tous les utilisateurs sont dans gmao.db → mise à jour dans la base admin.
 */
router.put('/me', authenticate, (req, res) => {
  const mainDb = dbModule.getAdminDb();
  const { pinnedMenuItems, dashboardLayout } = req.body || {};
  const row = mainDb.prepare('SELECT pinned_menu_items, dashboard_layout FROM users WHERE id = ?').get(req.user.id);
  const pinnedPayload = Array.isArray(pinnedMenuItems) ? pinnedMenuItems : (row ? JSON.parse(row.pinned_menu_items || '[]') : []);
  const layoutPayload = dashboardLayout !== undefined
    ? (Array.isArray(dashboardLayout) ? dashboardLayout : null)
    : (row?.dashboard_layout ? JSON.parse(row.dashboard_layout) : null);
  mainDb.prepare('UPDATE users SET pinned_menu_items = ?, dashboard_layout = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(JSON.stringify(pinnedPayload), layoutPayload ? JSON.stringify(layoutPayload) : null, req.user.id);
  mainDb._save();
  res.json({
    id: req.user.id,
    pinnedMenuItems: pinnedPayload,
    dashboardLayout: layoutPayload
  });
});

module.exports = router;
