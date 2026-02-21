/**
 * Routes d'authentification - Login, profil
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../database/db');
const { authenticate, JWT_SECRET, ROLES } = require('../middleware/auth');

const router = express.Router();
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '24h';

const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_MAX = 10;
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
 * Connexion utilisateur
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], (req, res) => {
  if (isLoginRateLimited(req)) {
    return res.status(429).json({ error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { email, password } = req.body;
  const user = db.prepare(`
    SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.role_id, r.name as role_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.email = ? AND u.is_active = 1
  `).get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }
  const token = jwt.sign(
    { userId: user.id, role: user.role_name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role_name
    }
  });
});

/**
 * GET /api/auth/me
 * Profil utilisateur courant (nécessite authentification)
 */
router.get('/me', authenticate, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    firstName: req.user.first_name,
    lastName: req.user.last_name,
    role: req.user.role_name
  });
});

module.exports = router;
