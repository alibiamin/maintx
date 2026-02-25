/**
 * Routes d'authentification - Login, profil
 * Schéma professionnel : JWT court (access) + refresh token en cookie httpOnly.
 * Tous les utilisateurs sont dans gmao.db.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const dbModule = require('../database/db');
const { authenticate, JWT_SECRET, ROLES } = require('../middleware/auth');
const auditLog = require('../services/auditLog');

const router = express.Router();

function getPermissionsForRoleId(adminDb, roleId) {
  try {
    return adminDb.prepare(`
      SELECT p.code FROM permissions p
      INNER JOIN role_permissions rp ON rp.permission_id = p.id
      WHERE rp.role_id = ?
    `).all(roleId).map(r => r.code);
  } catch (e) {
    return [];
  }
}

const ACCESS_TOKEN_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_TOKEN_DAYS = parseInt(process.env.REFRESH_TOKEN_DAYS, 10) || 7;
const COOKIE_NAME = 'refreshToken';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function buildRefreshCookieOptions(req) {
  const isProd = process.env.NODE_ENV === 'production';
  const isHttps = req && (req.secure || (req.headers && req.headers['x-forwarded-proto'] === 'https'));
  const maxAge = REFRESH_TOKEN_DAYS * 24 * 60 * 60;
  const options = {
    httpOnly: true,
    secure: isProd || isHttps,
    sameSite: 'lax',
    path: '/api',
    maxAge,
    signed: false
  };
  if (req && req.get && req.get('host') && req.get('host').includes('maintx.org')) {
    options.domain = '.maintx.org';
  }
  return options;
}

function clearRefreshCookie(res, req) {
  res.cookie(COOKIE_NAME, '', { ...buildRefreshCookieOptions(req), maxAge: 0 });
}

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
        tenant = mainDb.prepare('SELECT id, status, deleted_at, license_start, license_end FROM tenants WHERE id = ?').get(tenantId);
      } catch (e) {
        if (e.message && e.message.includes('no such column')) {
          tenant = mainDb.prepare('SELECT id, license_start, license_end FROM tenants WHERE id = ?').get(tenantId);
          if (tenant) { tenant.status = 'active'; tenant.deleted_at = null; }
        } else if (e.message && e.message.includes('no such table')) tenant = null;
        else throw e;
      }
      if (!tenant) {
        return res.status(403).json({
          error: 'Compte client désactivé ou supprimé. Contactez l\'administrateur.',
          code: 'TENANT_INVALID'
        });
      }
      const status = (tenant.status && String(tenant.status).trim()) || 'active';
      if (status === 'deleted' || tenant.deleted_at) {
        return res.status(403).json({ error: 'Ce client a été supprimé. Connexion impossible.', code: 'TENANT_DELETED' });
      }
      if (status === 'suspended' || status === 'expired') {
        return res.status(403).json({
          error: status === 'suspended' ? 'Compte client suspendu. Contactez l\'administrateur.' : 'Licence expirée. Contactez l\'administrateur.',
          code: status === 'suspended' ? 'TENANT_SUSPENDED' : 'LICENSE_EXPIRED'
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
    const isMaintxAdmin = tenantId == null;
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role_name, tenantId, isMaintxAdmin },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES }
    );
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const adminDb = dbModule.getAdminDb();
    try {
      adminDb.prepare(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
      ).run(user.id, tokenHash, expiresAt);
      if (adminDb._save) adminDb._save();
    } catch (e) {
      console.error('[auth/login] refresh_tokens insert:', e.message);
      return res.status(500).json({ error: 'Erreur lors de la création de la session.' });
    }
    res.cookie(COOKIE_NAME, refreshToken, buildRefreshCookieOptions(req));
    try {
      auditLog.log({
        userId: user.id,
        tenantId: tenantId ?? null,
        action: 'login',
        resource: 'auth',
        ip: auditLog.getClientIp(req)
      });
    } catch (_) {}
    const expiresInSeconds = 15 * 60;
    const permissions = getPermissionsForRoleId(adminDb, user.role_id);
    return res.json({
      accessToken,
      expiresIn: expiresInSeconds,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role_name,
        permissions,
        isAdmin: tenantId == null
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
 * POST /api/auth/refresh
 * Renouvelle l'access token à partir du refresh token (cookie httpOnly). Pas d'auth Bearer requise.
 */
router.post('/refresh', (req, res) => {
  try {
    const refreshToken = req.cookies?.[COOKIE_NAME];
    if (!refreshToken || typeof refreshToken !== 'string') {
      clearRefreshCookie(res, req);
      return res.status(401).json({ error: 'Session expirée ou invalide' });
    }
    const tokenHash = hashToken(refreshToken);
    const adminDb = dbModule.getAdminDb();
    const row = adminDb.prepare(
      `SELECT id, user_id FROM refresh_tokens WHERE token_hash = ? AND expires_at > datetime('now') AND revoked_at IS NULL`
    ).get(tokenHash);
    if (!row) {
      clearRefreshCookie(res, req);
      try {
        adminDb.prepare('UPDATE refresh_tokens SET revoked_at = datetime("now") WHERE token_hash = ?').run(tokenHash);
        if (adminDb._save) adminDb._save();
      } catch (_) {}
      return res.status(401).json({ error: 'Session expirée ou invalide' });
    }
    const userRow = adminDb.prepare(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.is_active = 1
    `).get(row.user_id);
    if (!userRow) {
      clearRefreshCookie(res, req);
      try {
        adminDb.prepare('UPDATE refresh_tokens SET revoked_at = datetime("now") WHERE id = ?').run(row.id);
        if (adminDb._save) adminDb._save();
      } catch (_) {}
      return res.status(401).json({ error: 'Utilisateur non trouvé ou inactif' });
    }
    let tenantId = null;
    try {
      const t = adminDb.prepare('SELECT tenant_id FROM users WHERE id = ?').get(userRow.id);
      if (t && t.tenant_id != null) tenantId = t.tenant_id;
    } catch (_) {}
    const isMaintxAdmin = tenantId == null;
    const accessToken = jwt.sign(
      { userId: userRow.id, role: userRow.role_name, tenantId, isMaintxAdmin },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES }
    );
    const permissions = getPermissionsForRoleId(adminDb, userRow.role_id);
    const expiresInSeconds = 15 * 60;
    res.json({
      accessToken,
      expiresIn: expiresInSeconds,
      user: {
        id: userRow.id,
        email: userRow.email,
        firstName: userRow.first_name,
        lastName: userRow.last_name,
        role: userRow.role_name,
        permissions,
        isAdmin: tenantId == null
      }
    });
  } catch (err) {
    console.error('[auth/refresh]', err.message || err);
    const msg = (err.message || '').toLowerCase();
    const isTableMissing = msg.includes('no such table') || msg.includes('refresh_tokens');
    res.status(500).json({
      error: isTableMissing
        ? 'Base de données non à jour. Redémarrez le serveur backend pour exécuter les migrations.'
        : 'Erreur serveur lors du rafraîchissement de la session.'
    });
  }
});

/**
 * POST /api/auth/logout
 * Révoque le refresh token et efface le cookie. Pas d'auth Bearer requise.
 */
router.post('/logout', (req, res) => {
  const refreshToken = req.cookies?.[COOKIE_NAME];
  if (refreshToken && typeof refreshToken === 'string') {
    const tokenHash = hashToken(refreshToken);
    const adminDb = dbModule.getAdminDb();
    try {
      adminDb.prepare('UPDATE refresh_tokens SET revoked_at = datetime("now") WHERE token_hash = ?').run(tokenHash);
      if (adminDb._save) adminDb._save();
    } catch (_) {}
  }
  clearRefreshCookie(res, req);
  res.status(204).end();
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
    permissions: req.user.permissions || [],
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
