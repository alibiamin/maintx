/**
 * API Documents obligatoires par type d'équipement / catégorie / site
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticate, authorize, requirePermission, ROLES } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', requirePermission('required_document_types', 'view'), (req, res) => {
  const db = req.db;
  const { entityType, entityId } = req.query;
  try {
    let sql = 'SELECT id, entity_type, entity_id, document_type_name, is_mandatory, created_at FROM required_document_types WHERE 1=1';
    const params = [];
    if (entityType) { sql += ' AND entity_type = ?'; params.push(entityType); }
    if (entityId) { sql += ' AND entity_id = ?'; params.push(entityId); }
    sql += ' ORDER BY entity_type, entity_id, document_type_name';
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json([]);
    throw e;
  }
});

router.post('/', requirePermission('required_document_types', 'create'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), [
  body('entityType').isIn(['equipment_category', 'equipment', 'site']),
  body('entityId').isInt(),
  body('documentTypeName').notEmpty().trim(),
  body('isMandatory').optional().isBoolean()
], (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { entityType, entityId, documentTypeName, isMandatory } = req.body;
  try {
    db.prepare(`
      INSERT INTO required_document_types (entity_type, entity_id, document_type_name, is_mandatory)
      VALUES (?, ?, ?, ?)
    `).run(entityType, entityId, documentTypeName.trim(), isMandatory !== false ? 1 : 0);
    const row = db.prepare('SELECT * FROM required_document_types WHERE entity_type = ? AND entity_id = ? AND document_type_name = ?').get(entityType, entityId, documentTypeName.trim());
    res.status(201).json(row);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ce type de document est déjà requis pour cette entité.' });
    if (e.message && e.message.includes('no such table')) return res.status(501).json({ error: 'Table required_document_types absente.' });
    throw e;
  }
});

router.delete('/:id', requirePermission('required_document_types', 'delete'), authorize(ROLES.ADMIN, ROLES.RESPONSABLE), param('id').isInt(), (req, res) => {
  const db = req.db;
  const r = db.prepare('DELETE FROM required_document_types WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Type de document obligatoire non trouvé' });
  res.status(204).send();
});

/**
 * GET /api/required-document-types/check?equipmentId= ou siteId=
 * Retourne les documents obligatoires manquants ou expirés pour un équipement ou un site
 */
router.get('/check', requirePermission('required_document_types', 'view'), query('equipmentId').optional().isInt(), query('siteId').optional().isInt(), (req, res) => {
  const db = req.db;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const equipmentId = req.query.equipmentId ? parseInt(req.query.equipmentId, 10) : null;
  const siteId = req.query.siteId ? parseInt(req.query.siteId, 10) : null;
  if (!equipmentId && !siteId) return res.status(400).json({ error: 'equipmentId ou siteId requis' });
  try {
    const result = { missing: [], expired: [], ok: [] };
    if (equipmentId) {
      const eq = db.prepare('SELECT id, category_id FROM equipment WHERE id = ?').get(equipmentId);
      if (!eq) return res.status(404).json({ error: 'Équipement non trouvé' });
      const required = [];
      const byEquip = db.prepare('SELECT document_type_name FROM required_document_types WHERE entity_type = ? AND entity_id = ?').all('equipment', equipmentId);
      const byCat = eq.category_id ? db.prepare('SELECT document_type_name FROM required_document_types WHERE entity_type = ? AND entity_id = ?').all('equipment_category', eq.category_id) : [];
      const typeNames = [...new Set([...byEquip.map((r) => r.document_type_name), ...byCat.map((r) => r.document_type_name)])];
      let docs = [];
      try {
        docs = db.prepare(`
          SELECT id, entity_type, entity_id, filename, original_filename, file_path, document_type, created_at
          FROM documents WHERE entity_type = 'equipment' AND entity_id = ?
        `).all(equipmentId);
      } catch (_) {}
      const byDocType = {};
      docs.forEach((d) => {
        const name = (d.document_type || d.original_filename || d.filename || '').replace(/\.[^.]+$/, '') || 'document';
        if (!byDocType[name]) byDocType[name] = [];
        byDocType[name].push(d);
      });
      for (const name of typeNames) {
        const attached = byDocType[name] || [];
        if (attached.length === 0) result.missing.push({ documentTypeName: name, entityType: 'equipment', entityId: equipmentId });
        else {
          let hasExpired = false;
          try {
            const withExpiry = db.prepare('SELECT expiry_date FROM documents WHERE entity_type = ? AND entity_id = ? LIMIT 1').get('equipment', equipmentId);
            hasExpired = withExpiry && withExpiry.expiry_date && new Date(withExpiry.expiry_date) < new Date();
          } catch (_) {}
          if (hasExpired) result.expired.push({ documentTypeName: name, entityType: 'equipment', entityId: equipmentId });
          else result.ok.push({ documentTypeName: name });
        }
      }
    }
    if (siteId) {
      const required = db.prepare('SELECT document_type_name FROM required_document_types WHERE entity_type = ? AND entity_id = ?').all('site', siteId);
      let docList = [];
      try {
        docList = db.prepare('SELECT id, filename, original_filename, document_type FROM documents WHERE entity_type = ? AND entity_id = ?').all('site', siteId);
      } catch (_) {}
      for (const r of required) {
        const name = r.document_type_name;
        const attached = docList.filter((d) => (d.document_type || d.original_filename || d.filename || '').includes(name) || name === (d.original_filename || d.filename || '').replace(/\.[^.]+$/, ''));
        if (attached.length === 0) result.missing.push({ documentTypeName: name, entityType: 'site', entityId: siteId });
        else result.ok.push({ documentTypeName: name });
      }
    }
    res.json(result);
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return res.json({ missing: [], expired: [], ok: [] });
    throw e;
  }
});

module.exports = router;
