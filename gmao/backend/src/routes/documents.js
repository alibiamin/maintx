/**
 * Routes pour la gestion des documents et pièces jointes
 */

const express = require('express');
const { param, validationResult } = require('express-validator');
const router = express.Router();
const { authenticate, requirePermission } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/** Un seul segment alphanumérique/underscore/tiret pour éviter path traversal */
function sanitizeEntityType(raw) {
  const s = String(raw || 'general').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return s || 'general';
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const entityType = sanitizeEntityType(req.body && req.body.entity_type);
    const entityDir = path.join(uploadsDir, entityType);
    if (!fs.existsSync(entityDir)) {
      fs.mkdirSync(entityDir, { recursive: true });
    }
    cb(null, entityDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Type de fichier non autorisé'));
  }
});

// Middleware d'authentification optionnel pour certaines routes
router.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticate(req, res, next);
  }
  next();
});

router.get('/', requirePermission('documents', 'view'), (req, res) => {
  const db = req.db;
  if (!db) return res.status(401).json({ error: 'Authentification requise' });
  try {
    const { entity_type, entity_id } = req.query;
    let query = 'SELECT d.*, u.first_name, u.last_name FROM documents d LEFT JOIN users u ON d.uploaded_by = u.id WHERE 1=1';
    const params = [];

    if (entity_type) {
      query += ' AND d.entity_type = ?';
      params.push(entity_type);
    }
    if (entity_id) {
      query += ' AND d.entity_id = ?';
      params.push(entity_id);
    }

    query += ' ORDER BY d.created_at DESC';

    const docs = db.prepare(query).all(...params);
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/documents/:id/download — déclaré avant /:id pour que "download" ne soit pas capturé comme id
router.get('/:id/download', requirePermission('documents', 'view'), param('id').isInt({ min: 1 }), (req, res) => {
  const db = req.db;
  if (!db) return res.status(401).json({ error: 'Authentification requise' });
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });
  try {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }
    const resolvedPath = path.resolve(doc.file_path);
    const uploadsResolved = path.resolve(uploadsDir);
    if (!resolvedPath.startsWith(uploadsResolved) || resolvedPath === uploadsResolved) {
      return res.status(403).json({ error: 'Chemin de fichier invalide' });
    }
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Fichier non trouvé sur le serveur' });
    }
    res.download(resolvedPath, doc.original_filename || path.basename(resolvedPath));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', requirePermission('documents', 'view'), param('id').isInt({ min: 1 }), (req, res) => {
  const db = req.db;
  if (!db) return res.status(401).json({ error: 'Authentification requise' });
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });
  try {
    const doc = db.prepare('SELECT d.*, u.first_name, u.last_name FROM documents d LEFT JOIN users u ON d.uploaded_by = u.id WHERE d.id = ?').get(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/documents
router.post('/', requirePermission('documents', 'create'), upload.single('file'), (req, res) => {
  const db = req.db;
  if (!db) return res.status(401).json({ error: 'Authentification requise' });
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const { entity_id, document_type, description } = req.body;
    const entity_type = sanitizeEntityType(req.body && req.body.entity_type);
    const userId = req.user?.id || null;

    const result = db.prepare(`
      INSERT INTO documents (entity_type, entity_id, filename, original_filename, file_path, file_size, mime_type, document_type, description, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entity_type,
      entity_id,
      req.file.filename,
      req.file.originalname,
      req.file.path,
      req.file.size,
      req.file.mimetype,
      document_type || 'other',
      description || null,
      userId
    );

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/documents/:id
router.delete('/:id', requirePermission('documents', 'delete'), param('id').isInt({ min: 1 }), (req, res) => {
  const db = req.db;
  if (!db) return res.status(401).json({ error: 'Authentification requise' });
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });
  try {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    const resolvedPath = path.resolve(doc.file_path);
    const uploadsResolved = path.resolve(uploadsDir);
    if (resolvedPath.startsWith(uploadsResolved) && resolvedPath !== uploadsResolved && fs.existsSync(resolvedPath)) {
      fs.unlinkSync(resolvedPath);
    }

    db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
    res.json({ message: 'Document supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
