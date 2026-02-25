/**
 * Configuration centralisée du panneau d'actions : chaque route de l'app a un contexte par défaut.
 * Garantit un panneau dynamique et fonctionnel sur toutes les pages sans exception.
 */

const APP_BASE = '/app';

/** Segments qui indiquent une liste (pas un détail par id). */
const LIST_SEGMENTS = new Set([
  'map', 'categories', 'models', 'technical', 'new', 'roles', 'lines', 'assignments', 'resources',
  'movements', 'inventories', 'alerts', 'entries', 'exits', 'transfers', 'reorders', 'orders',
  'exports', 'calibrations', 'due', 'activity', 'kpis', 'creation', 'contractors', 'catalog',
  'plans', 'parts', 'plans', 'assignments', 'resources', 'movements', 'inventories', 'alerts',
  'entries', 'exits', 'transfers', 'reorders', 'quality', 'locations', 'reservations',
  'root-causes', 'satisfaction', 'mtbf-mttr', 'email-templates', 'tenants', 'failure-codes',
  'part-families', 'brands', 'wo-templates', 'export', 'import', 'team', 'competencies',
  'type-competencies', 'presence', 'pointage'
]);

/**
 * Retourne le contexte page par défaut pour un pathname donné.
 * Couvre toutes les routes de l'application (aligné sur App.jsx).
 * @returns { { type: 'list'|'detail'|'page', entityType?: string, pageId?: string } }
 */
export function getDefaultPageContext(pathname) {
  const normalized = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  let segs = normalized.split('/').filter(Boolean);
  if (segs[0] === 'app') segs = segs.slice(1);

  if (segs.length === 0) {
    return { type: 'page', pageId: 'dashboard' };
  }

  const first = segs[0];
  const second = segs[1];

  // Pages sans entité (type 'page') : titre et actions génériques
  if (first === 'dashboard' || first === '') {
    return { type: 'page', pageId: 'dashboard' };
  }
  if (first === 'reports' && !second) return { type: 'page', pageId: 'reports' };
  if (first === 'reports' && second === 'mtbf-mttr') return { type: 'page', pageId: 'reports-mtbf' };
  if (first === 'reports' && second === 'exports') return { type: 'page', pageId: 'reports-exports' };
  if (first === 'decision-support') return { type: 'page', pageId: 'decision-support' };
  if (first === 'standards') return { type: 'page', pageId: 'standards' };
  if (first === 'settings' && !second) return { type: 'page', pageId: 'settings' };
  if (first === 'settings' && second === 'roles') return { type: 'list', entityType: 'roles' };
  if (first === 'settings' && second === 'tenants') return { type: 'page', pageId: 'settings-tenants' };
  if (first === 'settings' && second === 'email-templates') return { type: 'page', pageId: 'settings-email' };
  if (first === 'settings' && second === 'creation') return { type: 'page', pageId: 'creation' };
  if (first === 'planning' && !second) return { type: 'page', pageId: 'planning' };
  if (first === 'planning') return { type: 'page', pageId: 'planning' };
  if (first === 'my-work-orders') return { type: 'page', pageId: 'my-work-orders' };
  if (first === 'intervention-requests') return { type: 'page', pageId: 'intervention-requests' };
  if (first === 'exploitation' || (first === 'exploitation' && second)) return { type: 'page', pageId: 'exploitation' };
  if (first === 'effectif') return { type: 'page', pageId: 'effectif' };
  if (first === 'failure-codes') return { type: 'list', entityType: 'failure-codes' };
  if (first === 'catalogue') return { type: 'page', pageId: 'catalogue' };
  if (first === 'budgets') return { type: 'list', entityType: 'budgets' };
  if (first === 'checklists') return { type: 'list', entityType: 'checklists' };
  if (first === 'procedures') return { type: 'page', pageId: 'procedures' };
  if (first === 'contracts') return { type: 'list', entityType: 'contracts' };
  if (first === 'users') return { type: 'list', entityType: 'users' };
  if (first === 'training') return { type: 'page', pageId: 'training' };
  if (first === 'subcontracting') return { type: 'page', pageId: 'subcontracting' };

  // Listes avec entityType (premier segment = type d'entité)
  const entityTypes = [
    'equipment', 'work-orders', 'maintenance-plans', 'maintenance-projects', 'stock', 'suppliers',
    'sites', 'technicians', 'tools'
  ];
  if (entityTypes.includes(first)) {
    if (second === 'new' || (first === 'work-orders' && second === 'new')) {
      return { type: 'page', pageId: 'creation' };
    }
    if (second && !LIST_SEGMENTS.has(second) && /^\d+$/.test(second)) {
      return { type: 'detail', entityType: first, id: second };
    }
    if (second === 'due' && first === 'maintenance-plans') return { type: 'page', pageId: 'maintenance-plans-due' };
    if (first === 'stock' && second === 'parts') return { type: 'detail', entityType: 'stock', id: segs[2] };
    if (first === 'maintenance-projects' && second === 'new') return { type: 'page', pageId: 'creation' };
    if (first === 'maintenance' && (second === 'root-causes' || second === 'satisfaction')) {
      return { type: 'page', pageId: first + '-' + second };
    }
    return { type: 'list', entityType: first };
  }

  // Fallback : liste équipements
  return { type: 'list', entityType: 'equipment' };
}

/** Titre par défaut pour les pages de type 'page'. */
export function getPageTitle(pageId) {
  const titles = {
    dashboard: 'Tableau de bord',
    reports: 'Rapports',
    'reports-mtbf': 'MTBF / MTTR',
    'reports-exports': 'Exports',
    'decision-support': 'Aide à la décision',
    standards: 'Bibliothèque des normes',
    settings: 'Paramétrage',
    'settings-tenants': 'Clients (tenants)',
    'settings-email': 'Templates email',
    planning: 'Planning',
    'my-work-orders': 'Mes OT du jour',
    'intervention-requests': 'Demandes d\'intervention',
    exploitation: 'Export / Import',
    effectif: 'Effectif',
    catalogue: 'Catalogue',
    training: 'Formation',
    subcontracting: 'Sous-traitance',
    creation: 'Création',
    'maintenance-plans-due': 'Plans en retard',
    procedures: 'Procédures',
    'maintenance-root-causes': 'Causes racines',
    'maintenance-satisfaction': 'Satisfaction'
  };
  return titles[pageId] || 'Actions';
}
