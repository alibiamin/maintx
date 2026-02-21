/**
 * Middleware d'authentification JWT et gestion des rôles
 */

const jwt = require('jsonwebtoken');
const db = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'xmaint-jwt-secret-change-in-production';

/**
 * Vérifie le token JWT et attache l'utilisateur à req.user
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant ou invalide' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, u.is_active, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.is_active = 1
    `).get(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non trouvé ou inactif' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token expiré ou invalide' });
  }
}

/**
 * Vérifie que l'utilisateur possède l'un des rôles autorisés
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (allowedRoles.includes(req.user.role_name)) {
      return next();
    }
    return res.status(403).json({ error: 'Accès refusé - permissions insuffisantes' });
  };
}

/**
 * Rôles disponibles
 */
const ROLES = {
  ADMIN: 'administrateur',
  RESPONSABLE: 'responsable_maintenance',
  TECHNICIEN: 'technicien',
  UTILISATEUR: 'utilisateur'
};

module.exports = {
  authenticate,
  authorize,
  JWT_SECRET,
  ROLES
};
