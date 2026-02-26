/**
 * Correspondance route (path sous /app) → permission requise (resource + action).
 * Utilisé pour protéger chaque page : sans la permission "view", pas d'accès (redirection /forbidden).
 * Inspiré de la gestion des habilitations type Sage X3 (qui voit quoi).
 *
 * Clé = path tel que défini dans <Route path="..."> (sans /app).
 * Valeur = { resource, action } ou null (accès sans permission spécifique, ex. dashboard si tout le monde a dashboard.view).
 */

export const ROUTE_PERMISSIONS = {
  // Vue d'ensemble
  '': { resource: 'dashboard', action: 'view' },
  'dashboard/kpis': { resource: 'dashboard', action: 'view' },
  'dashboard/activity': { resource: 'dashboard', action: 'view' },
  // Équipements
  'equipment': { resource: 'equipment', action: 'view' },
  'equipment/creation/:type': { resource: 'equipment', action: 'create' },
  'equipment/map': { resource: 'equipment', action: 'view' },
  'equipment/categories': { resource: 'equipment', action: 'view' },
  'equipment/models': { resource: 'equipment_models', action: 'view' },
  'equipment/technical': { resource: 'equipment', action: 'view' },
  'equipment/:id': { resource: 'equipment', action: 'view' },
  'equipment/:id/technical': { resource: 'equipment', action: 'view' },
  'equipment/:id/history': { resource: 'equipment', action: 'view' },
  'equipment/:id/documents': { resource: 'documents', action: 'view' },
  'equipment/:id/warranties': { resource: 'equipment', action: 'view' },
  // Maintenance / OT
  'work-orders': { resource: 'work_orders', action: 'view' },
  'work-orders/new': { resource: 'work_orders', action: 'create' },
  'work-orders/:id': { resource: 'work_orders', action: 'view' },
  'my-work-orders': { resource: 'work_orders', action: 'view' },
  'maintenance/creation/:type': { resource: 'work_orders', action: 'create' },
  'intervention-requests': { resource: 'intervention_requests', action: 'view' },
  'sites': { resource: 'sites', action: 'view' },
  'sites/departments': { resource: 'sites', action: 'view' },
  'sites/lines': { resource: 'sites', action: 'view' },
  'sites/map': { resource: 'sites', action: 'view' },
  'planning': { resource: 'planning', action: 'view' },
  'planning/assignments': { resource: 'planning', action: 'view' },
  'planning/resources': { resource: 'planning', action: 'view' },
  'chat': { resource: 'chat', action: 'view' },
  'maintenance-plans': { resource: 'maintenance_plans', action: 'view' },
  'maintenance-plans/due': { resource: 'maintenance_plans', action: 'view' },
  'maintenance-projects': { resource: 'maintenance_projects', action: 'view' },
  'maintenance-projects/new': { resource: 'maintenance_projects', action: 'create' },
  'maintenance-projects/:id': { resource: 'maintenance_projects', action: 'view' },
  'maintenance-projects/:id/edit': { resource: 'maintenance_projects', action: 'update' },
  'checklists': { resource: 'checklists', action: 'view' },
  'procedures': { resource: 'procedures', action: 'view' },
  'maintenance/root-causes': { resource: 'root_causes', action: 'view' },
  'maintenance/satisfaction': { resource: 'satisfaction', action: 'view' },
  'maintenance/shutdowns': { resource: 'planned_shutdowns', action: 'view' },
  'maintenance/regulatory-checks': { resource: 'regulatory_checks', action: 'view' },
  // Outils
  'tools': { resource: 'tools', action: 'view' },
  'tools/creation/:type': { resource: 'tools', action: 'create' },
  'tools/assignments': { resource: 'tools', action: 'view' },
  'tools/calibrations': { resource: 'tools', action: 'view' },
  // Stock
  'stock': { resource: 'stock', action: 'view' },
  'stock/creation/:type': { resource: 'stock', action: 'create' },
  'stock/parts/:id': { resource: 'stock', action: 'view' },
  'stock/movements': { resource: 'stock', action: 'view' },
  'stock/inventories': { resource: 'stock', action: 'view' },
  'stock/alerts': { resource: 'stock', action: 'view' },
  'stock/entries': { resource: 'stock', action: 'view' },
  'stock/exits': { resource: 'stock', action: 'view' },
  'stock/transfers': { resource: 'stock', action: 'view' },
  'stock/reorders': { resource: 'stock', action: 'view' },
  'stock/quality': { resource: 'stock', action: 'view' },
  'stock/locations': { resource: 'stock_locations', action: 'view' },
  'stock/reservations': { resource: 'stock_reservations', action: 'view' },
  'stock/warehouses': { resource: 'warehouses', action: 'view' },
  'stock/reorder-rules': { resource: 'reorder_rules', action: 'view' },
  // Fournisseurs & Achats
  'suppliers': { resource: 'suppliers', action: 'view' },
  'suppliers/creation/:type': { resource: 'suppliers', action: 'create' },
  'suppliers/orders': { resource: 'suppliers', action: 'view' },
  'suppliers/purchase-requests': { resource: 'purchase_requests', action: 'view' },
  'contracts': { resource: 'contracts', action: 'view' },
  // Sous-traitance
  'subcontracting/contractors': { resource: 'external_contractors', action: 'view' },
  'subcontracting/orders': { resource: 'subcontract_orders', action: 'view' },
  'subcontracting/contracts': { resource: 'contracts', action: 'view' },
  // Budget
  'budgets': { resource: 'budgets', action: 'view' },
  // Effectif & Formation
  'technicians': { resource: 'technicians', action: 'view' },
  'technicians/team': { resource: 'technicians', action: 'view' },
  'technicians/competencies': { resource: 'competencies', action: 'view' },
  'technicians/type-competencies': { resource: 'competencies', action: 'view' },
  'technicians/:id': { resource: 'technicians', action: 'view' },
  'training/catalog': { resource: 'training_catalog', action: 'view' },
  'training/plans': { resource: 'training_plans', action: 'view' },
  'effectif/presence': { resource: 'presence', action: 'view' },
  'effectif/pointage': { resource: 'time_entries', action: 'view' },
  // Rapports & Analyse
  'reports': { resource: 'reports', action: 'view' },
  'reports/mtbf-mttr': { resource: 'reports', action: 'view' },
  'reports/exports': { resource: 'reports', action: 'view' },
  'decision-support': { resource: 'reports', action: 'view' },
  // Catalogue / Paramétrage
  'catalogue/part-families': { resource: 'part_families', action: 'view' },
  'catalogue/brands': { resource: 'brands', action: 'view' },
  'catalogue/wo-templates': { resource: 'work_order_templates', action: 'view' },
  'failure-codes': { resource: 'failure_codes', action: 'view' },
  'settings': { resource: 'settings', action: 'view' },
  'settings/creation/:type': { resource: 'users', action: 'create' },
  'settings/roles': { resource: 'settings', action: 'view' },
  'settings/tenants': { resource: 'tenants', action: 'view' },
  'settings/email-templates': { resource: 'settings', action: 'view' },
  'users': { resource: 'users', action: 'view' },
  // Exploitation (import/export)
  'exploitation': { resource: 'exploitation', action: 'view' },
  'exploitation/export': { resource: 'exploitation', action: 'view' },
  'exploitation/import': { resource: 'exploitation', action: 'view' }
};

/**
 * Module métier par route (aligné backend). null = pas de module spécifique (ex. dashboard par défaut).
 * Utilisé pour filtrer menu et bloquer l’accès si le module n’est pas activé pour le tenant.
 */
export const ROUTE_MODULES = {
  '': 'dashboard',
  'dashboard/kpis': 'dashboard',
  'dashboard/activity': 'dashboard',
  'equipment': 'equipment',
  'equipment/creation/:type': 'equipment',
  'equipment/map': 'equipment',
  'equipment/categories': 'equipment',
  'equipment/models': 'equipment_models',
  'equipment/technical': 'equipment',
  'equipment/:id': 'equipment',
  'equipment/:id/technical': 'equipment',
  'equipment/:id/history': 'equipment',
  'equipment/:id/documents': 'documents',
  'equipment/:id/warranties': 'equipment',
  'work-orders': 'work_orders',
  'work-orders/new': 'work_orders',
  'work-orders/:id': 'work_orders',
  'my-work-orders': 'work_orders',
  'maintenance/creation/:type': 'work_orders',
  'intervention-requests': 'intervention_requests',
  'sites': 'sites',
  'sites/departments': 'sites',
  'sites/lines': 'sites',
  'sites/map': 'sites',
  'planning': 'planning',
  'planning/assignments': 'planning',
  'planning/resources': 'planning',
  'chat': 'chat',
  'maintenance-plans': 'maintenance_plans',
  'maintenance-plans/due': 'maintenance_plans',
  'maintenance-projects': 'maintenance_projects',
  'maintenance-projects/new': 'maintenance_projects',
  'maintenance-projects/:id': 'maintenance_projects',
  'maintenance-projects/:id/edit': 'maintenance_projects',
  'checklists': 'checklists',
  'procedures': 'procedures',
  'maintenance/root-causes': 'root_causes',
  'maintenance/satisfaction': 'satisfaction',
  'maintenance/shutdowns': 'planned_shutdowns',
  'maintenance/regulatory-checks': 'regulatory_checks',
  'tools': 'tools',
  'tools/creation/:type': 'tools',
  'tools/assignments': 'tools',
  'tools/calibrations': 'tools',
  'stock': 'stock',
  'stock/creation/:type': 'stock',
  'stock/parts/:id': 'stock',
  'stock/movements': 'stock',
  'stock/inventories': 'stock',
  'stock/alerts': 'stock',
  'stock/entries': 'stock',
  'stock/exits': 'stock',
  'stock/transfers': 'stock',
  'stock/reorders': 'stock',
  'stock/quality': 'stock',
  'stock/locations': 'stock_locations',
  'stock/reservations': 'stock_reservations',
  'stock/warehouses': 'warehouses',
  'stock/reorder-rules': 'reorder_rules',
  'suppliers': 'suppliers',
  'suppliers/creation/:type': 'suppliers',
  'suppliers/orders': 'suppliers',
  'suppliers/purchase-requests': 'purchase_requests',
  'contracts': 'contracts',
  'subcontracting/contractors': 'external_contractors',
  'subcontracting/orders': 'subcontract_orders',
  'subcontracting/contracts': 'contracts',
  'budgets': 'budgets',
  'technicians': 'technicians',
  'technicians/team': 'technicians',
  'technicians/competencies': 'competencies',
  'technicians/type-competencies': 'competencies',
  'technicians/:id': 'technicians',
  'effectif/presence': 'presence',
  'effectif/pointage': 'time_entries',
  'training/catalog': 'training_catalog',
  'training/plans': 'training_plans',
  'reports': 'reports',
  'reports/mtbf-mttr': 'reports',
  'reports/exports': 'reports',
  'decision-support': 'reports',
  'catalogue/part-families': 'part_families',
  'catalogue/brands': 'brands',
  'catalogue/wo-templates': 'work_order_templates',
  'failure-codes': 'failure_codes',
  'settings': 'settings',
  'settings/creation/:type': 'users',
  'settings/roles': 'settings',
  'settings/tenants': 'tenants',
  'settings/email-templates': 'settings',
  'users': 'users',
  'exploitation': 'exploitation',
  'exploitation/export': 'exploitation',
  'exploitation/import': 'exploitation'
};

/**
 * Retourne le code module pour un pathname (ex. /app/stock/creation/piece → 'stock').
 * null = pas de module défini (accès autorisé si tenant a des restrictions).
 */
export function getModuleForPath(pathname) {
  const base = pathname.replace(/^\/app\/?/, '').replace(/\/$/, '') || '';
  if (ROUTE_MODULES[base]) return ROUTE_MODULES[base];
  const segments = base.split('/');
  for (const key of Object.keys(ROUTE_MODULES)) {
    const patternSegments = key.split('/');
    if (patternSegments.length !== segments.length) continue;
    let match = true;
    for (let i = 0; i < patternSegments.length; i++) {
      const p = patternSegments[i];
      const s = segments[i];
      if (p.startsWith(':')) continue;
      if (p !== s) { match = false; break; }
    }
    if (match) return ROUTE_MODULES[key];
  }
  return null;
}

/**
 * Retourne la permission pour un pathname (ex. /app/stock/creation/piece).
 * Compare avec les clés de ROUTE_PERMISSIONS en normalisant :id, :type en segments.
 */
export function getPermissionForPath(pathname) {
  const base = pathname.replace(/^\/app\/?/, '').replace(/\/$/, '') || '';
  // Correspondance exacte
  if (ROUTE_PERMISSIONS[base]) return ROUTE_PERMISSIONS[base];
  // Correspondance avec paramètres : remplacer :id, :type par la valeur réelle pour matcher le pattern
  const segments = base.split('/');
  for (const key of Object.keys(ROUTE_PERMISSIONS)) {
    const patternSegments = key.split('/');
    if (patternSegments.length !== segments.length) continue;
    let match = true;
    for (let i = 0; i < patternSegments.length; i++) {
      const p = patternSegments[i];
      const s = segments[i];
      if (p.startsWith(':')) continue; // :id, :type
      if (p !== s) { match = false; break; }
    }
    if (match) return ROUTE_PERMISSIONS[key];
  }
  return null;
}
