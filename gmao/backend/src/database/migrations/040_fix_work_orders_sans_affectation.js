/**
 * Migration 040 - Corriger les OT "Sans affectation"
 * - OT sans équipement (equipment_id NULL) → affectés au premier équipement
 * - Équipements sans ligne ni département → affectés à la première ligne (donc un site)
 */

function fixWoAssignment(db) {
  let updatedWo = 0;
  let updatedEquip = 0;

  try {
    const firstLigne = db.prepare('SELECT id FROM lignes ORDER BY id LIMIT 1').get();
    if (firstLigne) {
      const r = db.prepare(`
        UPDATE equipment
        SET ligne_id = ?
        WHERE (ligne_id IS NULL OR ligne_id = 0) AND (department_id IS NULL OR department_id = 0)
      `).run(firstLigne.id);
      updatedEquip = r.changes ?? 0;
    }
  } catch (e) {
    if (!e.message || (!e.message.includes('no such table') && !e.message.includes('no such column'))) throw e;
  }

  try {
    const firstEquip = db.prepare('SELECT id FROM equipment ORDER BY id LIMIT 1').get();
    if (firstEquip) {
      const r = db.prepare('UPDATE work_orders SET equipment_id = ? WHERE equipment_id IS NULL').run(firstEquip.id);
      updatedWo = r.changes ?? 0;
    }
  } catch (e) {
    if (!e.message || (!e.message.includes('no such table') && !e.message.includes('no such column'))) throw e;
  }

  return { updatedWo, updatedEquip };
}

function up(db) {
  const res = fixWoAssignment(db);
  if (res.updatedWo > 0 || res.updatedEquip > 0) {
    console.log('   [040] Base courante: OT sans équipement corrigés:', res.updatedWo, ', équipements sans ligne:', res.updatedEquip);
  }

  try {
    const dbModule = require('../db');
    const tenants = db.prepare('SELECT id, db_filename FROM tenants').all();
    for (const t of tenants || []) {
      try {
        const clientDb = dbModule.getClientDb(t.db_filename || t.id);
        const cr = fixWoAssignment(clientDb);
        if (cr.updatedWo > 0 || cr.updatedEquip > 0) {
          console.log('   [040] Tenant', t.db_filename || t.id, ': OT corrigés:', cr.updatedWo, ', équipements:', cr.updatedEquip);
        }
        if (clientDb._save) clientDb._save();
      } catch (e) {
        console.warn('   [040] Tenant', t.db_filename || t.id, ':', e.message);
      }
    }
  } catch (e) {
    if (!e.message || !e.message.includes('no such table')) console.warn('   [040] Tenants non traités:', e.message);
  }
}

module.exports = { up };
