/**
 * Migration 062 - Ajout des permissions dashboard (base admin)
 * Pour les bases déjà seedées sans la ressource dashboard : crée dashboard.view/create/update/delete
 * et attribue au moins dashboard.view à tous les rôles.
 */
function up(db) {
  const insertPerm = db.prepare(`
    INSERT OR IGNORE INTO permissions (code, resource, action, name_fr, name_en)
    VALUES (?, ?, ?, ?, ?)
  `);
  const actions = ['view', 'create', 'update', 'delete'];
  for (const action of actions) {
    const code = `dashboard.${action}`;
    const nameFr = `dashboard – ${action === 'view' ? 'Visualiser' : action === 'create' ? 'Créer' : action === 'update' ? 'Modifier' : 'Supprimer'}`;
    const nameEn = `dashboard – ${action}`;
    insertPerm.run(code, 'dashboard', action, nameFr, nameEn);
  }

  const viewPerm = db.prepare("SELECT id FROM permissions WHERE code = 'dashboard.view'").get();
  if (!viewPerm) return;

  const roleIds = db.prepare('SELECT id FROM roles').all().map((r) => r.id);
  const insertRP = db.prepare(`
    INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)
  `);
  for (const roleId of roleIds) {
    insertRP.run(roleId, viewPerm.id);
  }
}

module.exports = { up };
