/**
 * API Bibliothèque des normes - référentiel des normes de maintenance industrielle
 */

const express = require('express');
const { param, query, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const ORGANIZATIONS = ['ISO', 'IEC', 'API', 'ASME', 'EN'];
const STANDARD_TYPES = ['qualité', 'sécurité', 'fiabilité', 'secteur_spécifique', 'management_actifs', 'maintenance'];

function formatStandard(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    domain: row.domain,
    standardType: row.standard_type,
    organization: row.organization,
    documentUrl: row.document_url,
    objectives: row.objectives,
    sectorsEquipment: row.sectors_equipment,
    versionHistory: row.version_history,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * GET /api/standards
 * Liste des normes avec filtres : type, organization, search (code/title)
 */
router.get('/', [
  query('type').optional().isIn(STANDARD_TYPES),
  query('organization').optional().isIn(ORGANIZATIONS),
  query('search').optional().trim()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  let sql = 'SELECT * FROM standards WHERE 1=1';
  const params = [];
  if (req.query.type) {
    sql += ' AND standard_type = ?';
    params.push(req.query.type);
  }
  if (req.query.organization) {
    sql += ' AND organization = ?';
    params.push(req.query.organization);
  }
  if (req.query.search && req.query.search.trim()) {
    sql += ' AND (code LIKE ? OR title LIKE ? OR domain LIKE ?)';
    const term = '%' + req.query.search.trim() + '%';
    params.push(term, term, term);
  }
  sql += ' ORDER BY organization, code';

  try {
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='standards'").get();
    if (!hasTable) return res.json([]);
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(formatStandard));
  } catch (e) {
    console.error('[standards] list', e);
    res.status(500).json({ error: 'Erreur lors du chargement des normes.' });
  }
});

/**
 * GET /api/standards/:id
 * Détail d'une norme
 */
router.get('/:id', param('id').isInt(), (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='standards'").get();
    if (!hasTable) return res.status(404).json({ error: 'Norme non trouvée' });
    const row = db.prepare('SELECT * FROM standards WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Norme non trouvée' });
    res.json(formatStandard(row));
  } catch (e) {
    console.error('[standards] get', e);
    res.status(500).json({ error: 'Erreur lors du chargement de la norme.' });
  }
});

module.exports = router;
