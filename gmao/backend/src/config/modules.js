/**
 * Modules métier activables par tenant.
 * Chaque client peut n'avoir qu'un sous-ensemble de modules ; l'absence d'un module
 * ne doit pas faire planter l'application (403 propre + masquage côté frontend).
 *
 * pathPrefix (ordre décroissant de longueur pour match le plus spécifique en premier)
 * → code du module.
 */

const PATH_TO_MODULE = {
  '/api/dashboard': 'dashboard',
  '/api/equipment': 'equipment',
  '/api/equipment-models': 'equipment_models',
  '/api/procedures': 'procedures',
  '/api/work-orders': 'work_orders',
  '/api/work-order-templates': 'work_order_templates',
  '/api/planning': 'planning',
  '/api/stock': 'stock',
  '/api/stock-locations': 'stock_locations',
  '/api/stock-reservations': 'stock_reservations',
  '/api/stock-by-site': 'stock_by_site',
  '/api/part-families': 'part_families',
  '/api/part-categories': 'part_categories',
  '/api/part-sub-families': 'part_sub_families',
  '/api/brands': 'brands',
  '/api/warehouses': 'warehouses',
  '/api/reorder-rules': 'reorder_rules',
  '/api/suppliers': 'suppliers',
  '/api/purchase-requests': 'purchase_requests',
  '/api/price-requests': 'price_requests',
  '/api/supplier-invoices': 'supplier_invoices',
  '/api/external-contractors': 'external_contractors',
  '/api/subcontract-orders': 'subcontract_orders',
  '/api/maintenance-plans': 'maintenance_plans',
  '/api/maintenance-projects': 'maintenance_projects',
  '/api/documents': 'documents',
  '/api/contracts': 'contracts',
  '/api/alerts': 'alerts',
  '/api/checklists': 'checklists',
  '/api/tools': 'tools',
  '/api/technicians': 'technicians',
  '/api/competencies': 'competencies',
  '/api/time-entries': 'time_entries',
  '/api/attendance-overrides': 'attendance_overrides',
  '/api/presence': 'presence',
  '/api/notifications': 'notifications',
  '/api/search': 'search',
  '/api/intervention-requests': 'intervention_requests',
  '/api/exploitation': 'exploitation',
  '/api/budgets': 'budgets',
  '/api/training-catalog': 'training_catalog',
  '/api/training-plans': 'training_plans',
  '/api/satisfaction': 'satisfaction',
  '/api/root-causes': 'root_causes',
  '/api/reports': 'reports',
  '/api/scheduled-reports': 'scheduled_reports',
  '/api/audit': 'audit',
  '/api/standards': 'standards',
  '/api/required-document-types': 'required_document_types',
  '/api/planned-shutdowns': 'planned_shutdowns',
  '/api/regulatory-checks': 'regulatory_checks',
  '/api/sites': 'sites',
  '/api/failure-codes': 'failure_codes',
  '/api/settings': 'settings',
  '/api/users': 'users',
  '/api/permissions': 'permissions'
};

const sortedPrefixes = Object.keys(PATH_TO_MODULE).sort((a, b) => b.length - a.length);

function getModuleCodeForPath(path) {
  const p = (path || '').split('?')[0];
  for (const prefix of sortedPrefixes) {
    if (p.startsWith(prefix)) return PATH_TO_MODULE[prefix];
  }
  return null;
}

/** Liste de tous les codes de modules (pour admin / frontend). */
function getAllModuleCodes() {
  return [...new Set(Object.values(PATH_TO_MODULE))];
}

const VALID_MODULE_CODES = new Set(getAllModuleCodes());

/** Vérifie qu'un code module existe (évite d'invalider un tenant avec un code supprimé). */
function isValidModuleCode(code) {
  return typeof code === 'string' && VALID_MODULE_CODES.has(code);
}

/** Filtre un tableau de codes pour ne garder que les modules existants (isolation : un module absent ne casse pas les autres). */
function filterValidModuleCodes(codes) {
  if (!Array.isArray(codes)) return [];
  return codes.filter(isValidModuleCode);
}

/**
 * Packs de modules prédéfinis (pour proposer des offres Starter / Pro / Complet).
 * Seuls les codes présents dans PATH_TO_MODULE sont inclus ; l'absence d'un module n'affecte pas les autres.
 */
const MODULE_PACKS_RAW = [
  {
    id: 'starter',
    label: 'Starter',
    description: 'Vue d\'ensemble, équipements, sites et ordres de travail essentiels.',
    moduleCodes: ['dashboard', 'equipment', 'equipment_models', 'sites', 'work_orders', 'work_order_templates', 'procedures', 'planning', 'intervention_requests', 'failure_codes', 'settings', 'users', 'notifications']
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    description: 'Starter + plans de maintenance, projets, check-lists, causes racines.',
    moduleCodes: ['dashboard', 'equipment', 'equipment_models', 'sites', 'work_orders', 'work_order_templates', 'procedures', 'planning', 'maintenance_plans', 'maintenance_projects', 'checklists', 'root_causes', 'satisfaction', 'planned_shutdowns', 'regulatory_checks', 'intervention_requests', 'failure_codes', 'settings', 'users', 'notifications']
  },
  {
    id: 'pro',
    label: 'Pro',
    description: 'Maintenance + stock, fournisseurs, techniciens, rapports.',
    moduleCodes: ['dashboard', 'equipment', 'equipment_models', 'sites', 'work_orders', 'work_order_templates', 'procedures', 'planning', 'maintenance_plans', 'maintenance_projects', 'checklists', 'root_causes', 'satisfaction', 'planned_shutdowns', 'regulatory_checks', 'intervention_requests', 'stock', 'stock_locations', 'stock_reservations', 'part_families', 'brands', 'warehouses', 'reorder_rules', 'suppliers', 'purchase_requests', 'price_requests', 'supplier_invoices', 'contracts', 'technicians', 'competencies', 'time_entries', 'presence', 'reports', 'failure_codes', 'settings', 'users', 'notifications']
  },
  {
    id: 'complet',
    label: 'Complet',
    description: 'Tous les modules (sous-traitance, formation, audit, normes, exploitation).',
    moduleCodes: null
  }
];

/** Packs avec codes filtrés (seuls les modules existants ; null = tous). */
function getModulePacks() {
  return MODULE_PACKS_RAW.map((pack) => ({
    id: pack.id,
    label: pack.label,
    description: pack.description,
    moduleCodes: pack.moduleCodes === null ? null : filterValidModuleCodes(pack.moduleCodes)
  }));
}

/** Définition des modules pour l'UI (code, libellé). */
const MODULE_LABELS = {
  dashboard: 'Tableau de bord',
  equipment: 'Équipements',
  equipment_models: 'Modèles d\'équipement',
  procedures: 'Procédures',
  work_orders: 'Ordres de travail',
  work_order_templates: 'Modèles d\'OT',
  planning: 'Planification',
  stock: 'Stock / Pièces',
  stock_locations: 'Emplacements stock',
  stock_reservations: 'Réservations stock',
  stock_by_site: 'Stock par site',
  part_families: 'Familles de pièces',
  part_categories: 'Catégories de pièces',
  part_sub_families: 'Sous-familles',
  brands: 'Marques',
  warehouses: 'Entrepôts',
  reorder_rules: 'Règles de réappro',
  suppliers: 'Fournisseurs',
  purchase_requests: 'Demandes d\'achat',
  price_requests: 'Demandes de prix',
  supplier_invoices: 'Factures fournisseurs',
  external_contractors: 'Prestataires',
  subcontract_orders: 'Ordres de sous-traitance',
  maintenance_plans: 'Plans de maintenance',
  maintenance_projects: 'Projets de maintenance',
  documents: 'Documents',
  contracts: 'Contrats',
  alerts: 'Alertes',
  checklists: 'Check-lists',
  tools: 'Outillage',
  technicians: 'Techniciens',
  competencies: 'Compétences',
  time_entries: 'Pointages',
  attendance_overrides: 'Modulations présence',
  presence: 'Présence',
  notifications: 'Notifications',
  search: 'Recherche',
  intervention_requests: 'Demandes d\'intervention',
  exploitation: 'Exploitation',
  budgets: 'Budgets',
  training_catalog: 'Catalogue formation',
  training_plans: 'Plans de formation',
  satisfaction: 'Satisfaction',
  root_causes: 'Causes racines',
  reports: 'Rapports',
  scheduled_reports: 'Rapports planifiés',
  audit: 'Audit',
  standards: 'Normes',
  required_document_types: 'Types de documents requis',
  planned_shutdowns: 'Arrêts planifiés',
  regulatory_checks: 'Contrôles réglementaires',
  sites: 'Sites',
  failure_codes: 'Codes défaillance',
  settings: 'Paramètres',
  users: 'Utilisateurs',
  permissions: 'Permissions'
};

module.exports = {
  PATH_TO_MODULE,
  getModuleCodeForPath,
  getAllModuleCodes,
  getModulePacks,
  filterValidModuleCodes,
  isValidModuleCode,
  MODULE_LABELS
};
