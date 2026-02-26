/**
 * Seed des permissions et des affectations par défaut aux rôles.
 * À exécuter sur la base admin (gmao.db). Les rôles doivent déjà exister.
 */

const ACTIONS = ['view', 'create', 'update', 'delete'];

const RESOURCES = [
  'dashboard', 'equipment', 'work_orders', 'maintenance_plans', 'maintenance_projects', 'sites',
  'stock', 'suppliers', 'users', 'reports', 'settings', 'documents', 'contracts',
  'alerts', 'checklists', 'tools', 'planning', 'technicians', 'competencies',
  'notifications', 'intervention_requests', 'audit', 'procedures', 'tenants',
  'exploitation', 'part_families', 'part_categories', 'part_sub_families', 'brands',
  'budgets', 'external_contractors', 'subcontract_orders', 'training_catalog',
  'training_plans', 'satisfaction', 'root_causes', 'work_order_templates',
  'stock_locations', 'stock_reservations', 'time_entries', 'attendance_overrides',
  'presence', 'scheduled_reports', 'stock_by_site', 'required_document_types',
  'standards', 'failure_codes', 'equipment_models',
  'planned_shutdowns', 'purchase_requests', 'price_requests', 'supplier_invoices',
  'regulatory_checks', 'warehouses', 'reorder_rules',
  'chat'
];

const ROLE_NAMES = {
  ADMIN: 'administrateur',
  RESPONSABLE: 'responsable_maintenance',
  PLANIFICATEUR: 'planificateur',
  TECHNICIEN: 'technicien',
  UTILISATEUR: 'utilisateur'
};

/** Rôles qui ont toutes les permissions (aucune restriction) */
const FULL_ACCESS_ROLES = [ROLE_NAMES.ADMIN];

/** Permissions par défaut pour responsable_maintenance : tout sauf tenants/settings sensibles */
const RESPONSABLE_EXTRA = ['tenants']; // responsable n'a pas create/update/delete sur tenants

/** Ressources en lecture seule pour technicien (+ work_orders create/update pour ses OT) */
const TECHNICIEN_VIEW_ONLY = RESOURCES.filter(r => !['work_orders', 'time_entries', 'presence'].includes(r));

/** Ressources que planificateur peut modifier (planning, work_orders, maintenance_plans) */
const PLANIFICATEUR_FULL = ['planning', 'work_orders', 'maintenance_plans', 'technicians', 'intervention_requests'];
const PLANIFICATEUR_VIEW = RESOURCES.filter(r => !PLANIFICATEUR_FULL.includes(r));

function seedPermissions(adminDb) {
  if (!adminDb) return;
  try {
    const count = adminDb.prepare('SELECT COUNT(*) as c FROM permissions').get();
    const fullCount = RESOURCES.length * ACTIONS.length;
    if (count && count.c >= fullCount) return; // déjà seedé (au moins toutes les ressources)
  } catch (e) {
    return; // table n'existe pas encore
  }

  const insertPerm = adminDb.prepare(`
    INSERT OR IGNORE INTO permissions (code, resource, action, name_fr, name_en)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      const code = `${resource}.${action}`;
      const nameFr = `${resource} – ${action === 'view' ? 'Visualiser' : action === 'create' ? 'Créer' : action === 'update' ? 'Modifier' : 'Supprimer'}`;
      const nameEn = `${resource} – ${action}`;
      insertPerm.run(code, resource, action, nameFr, nameEn);
    }
  }

  const roleRows = adminDb.prepare('SELECT id, name FROM roles').all();
  const roleIds = {};
  roleRows.forEach(r => { roleIds[r.name] = r.id; });

  const allPermIds = adminDb.prepare('SELECT id FROM permissions').all().map(p => p.id);
  const insertRP = adminDb.prepare(`
    INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)
  `);

  for (const role of roleRows) {
    let permIds = [];
    if (FULL_ACCESS_ROLES.includes(role.name)) {
      permIds = allPermIds;
    } else if (role.name === ROLE_NAMES.RESPONSABLE) {
      permIds = allPermIds.filter(pid => {
        const p = adminDb.prepare('SELECT resource, action FROM permissions WHERE id = ?').get(pid);
        if (p.resource === 'tenants' && p.action !== 'view') return false;
        return true;
      });
    } else if (role.name === ROLE_NAMES.PLANIFICATEUR) {
      for (const pid of allPermIds) {
        const p = adminDb.prepare('SELECT resource, action FROM permissions WHERE id = ?').get(pid);
        if (PLANIFICATEUR_FULL.includes(p.resource)) permIds.push(pid);
        else if (PLANIFICATEUR_VIEW.includes(p.resource) && p.action === 'view') permIds.push(pid);
      }
    } else if (role.name === ROLE_NAMES.TECHNICIEN) {
      for (const pid of allPermIds) {
        const p = adminDb.prepare('SELECT resource, action FROM permissions WHERE id = ?').get(pid);
        if (p.action === 'view') permIds.push(pid);
        else if (['work_orders', 'time_entries', 'presence'].includes(p.resource) && ['create', 'update'].includes(p.action)) permIds.push(pid);
      }
    } else if (role.name === ROLE_NAMES.UTILISATEUR) {
      permIds = allPermIds.filter(pid => {
        const p = adminDb.prepare('SELECT action FROM permissions WHERE id = ?').get(pid);
        return p.action === 'view';
      });
    } else {
      permIds = allPermIds.filter(pid => {
        const p = adminDb.prepare('SELECT action FROM permissions WHERE id = ?').get(pid);
        return p.action === 'view';
      });
    }
    for (const pid of permIds) {
      insertRP.run(role.id, pid);
    }
  }

  if (adminDb._save) adminDb._save();
  console.log('[Permissions] Seed OK:', allPermIds.length, 'permissions, rôles assignés.');
}

module.exports = { seedPermissions, RESOURCES, ACTIONS, ROLE_NAMES };
