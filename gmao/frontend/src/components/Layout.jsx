import React, { useState, useMemo, useEffect, useRef, useCallback, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  TextField,
  InputAdornment,
  Button,
  Collapse,
  Divider,
  Paper,
  Chip,
  Badge,
  Breadcrumbs,
  Link,
  useTheme,
  alpha,
  Popper,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Build as BuildIcon,
  Business as BusinessIcon,
  AccountTree as AccountTreeIcon,
  Assignment as AssignmentIcon,
  CalendarMonth as CalendarIcon,
  DateRange as DateRangeIcon,
  Inventory as StockIcon,
  LocalShipping as SupplierIcon,
  Assessment as ReportsIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Logout,
  Description as DocumentsIcon,
  Article as ContractsIcon,
  CheckCircle as ChecklistsIcon,
  Handyman as ToolsIcon,
  Search,
  Help,
  Star,
  StarBorder,
  ExpandMore,
  ExpandLess,
  Close,
  MenuOpen,
  ChevronRight,
  Notifications as NotificationsIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ImportExport as ImportExportIcon,
  AccountBalance as BudgetIcon,
  BusinessCenter as SubcontractIcon,
  Lightbulb as LightbulbIcon,
  MenuBook as MenuBookIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { ActionBar } from '../context/ActionPanelContext';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import api from '../services/api';
import { LANGUAGES } from '../constants/languages';
import { useSnackbar } from '../context/SnackbarContext';

const APP_BASE = '/app';
const INTERVENTION_REQUEST_CHANNEL = 'gmao-intervention-request';
const PENDING_POLL_INTERVAL_MS = 20000;

/** Correspondance menu id → resource permission (pour filtrer le menu selon les permissions). */
const MENU_RESOURCE_MAP = {
  dashboard: 'dashboard',
  equipment: 'equipment',
  sites: 'sites',
  maintenance: 'work_orders',
  tools: 'tools',
  stock: 'stock',
  suppliers: 'suppliers',
  subcontracting: 'external_contractors',
  budget: 'budgets',
  effectif: 'technicians',
  reports: 'reports',
  decisionSupport: 'reports',
  standards: 'standards',
  exploitation: 'exploitation',
  settings: 'settings'
};

/** Correspondance menu id → module métier (pour filtrer le menu selon les modules activés par tenant). */
const MENU_MODULE_MAP = {
  dashboard: 'dashboard',
  equipment: 'equipment',
  sites: 'sites',
  maintenance: 'work_orders',
  tools: 'tools',
  stock: 'stock',
  suppliers: 'suppliers',
  subcontracting: 'external_contractors',
  budget: 'budgets',
  effectif: 'technicians',
  reports: 'reports',
  decisionSupport: 'reports',
  standards: 'standards',
  exploitation: 'exploitation',
  settings: 'settings'
};

/** Liste plate de tous les menus — réorganisée pour une UX claire : vue principale → détails → création. */
function getRawMenus() {
  return [
    // ——— Vue d'ensemble ———
    { id: 'dashboard', labelKey: 'menu.dashboard', icon: <DashboardIcon />, path: APP_BASE, sections: [
      { titleKey: 'section.dashboard_0', items: [
        { labelKey: 'item.dashboard_overview', path: APP_BASE },
        { labelKey: 'item.dashboard_kpis', path: `${APP_BASE}/dashboard/kpis` },
        { labelKey: 'item.dashboard_activity', path: `${APP_BASE}/dashboard/activity` }
      ]}
    ]},
    // ——— Actifs & Sites ———
    { id: 'equipment', labelKey: 'menu.equipment', icon: <BuildIcon />, path: `${APP_BASE}/equipment`, sections: [
      { titleKey: 'section.equipment_0', items: [
        { labelKey: 'item.equipment_list', path: `${APP_BASE}/equipment` },
        { labelKey: 'item.equipment_map', path: `${APP_BASE}/equipment/map` },
        { labelKey: 'item.equipment_categories', path: `${APP_BASE}/equipment/categories` },
        { labelKey: 'item.equipment_models', path: `${APP_BASE}/equipment/models` },
        { labelKey: 'item.equipment_technical', path: `${APP_BASE}/equipment/technical` }
      ]},
      { titleKey: 'section.equipment_1', items: [
        { labelKey: 'item.management_history', path: `${APP_BASE}/equipment?view=history` },
        { labelKey: 'item.management_documents', path: `${APP_BASE}/equipment?view=documents` },
        { labelKey: 'item.management_warranties', path: `${APP_BASE}/equipment?view=warranties` }
      ]},
      { titleKey: 'section.equipment_creation', items: [
        { labelKey: 'item.creation_site', path: `${APP_BASE}/equipment/creation/site`, action: 'create' },
        { labelKey: 'item.creation_departement', path: `${APP_BASE}/equipment/creation/departement`, action: 'create' },
        { labelKey: 'item.creation_ligne', path: `${APP_BASE}/equipment/creation/ligne`, action: 'create' },
        { labelKey: 'item.creation_machine', path: `${APP_BASE}/equipment/creation/machine`, action: 'create' },
        { labelKey: 'item.creation_section', path: `${APP_BASE}/equipment/creation/section`, action: 'create' },
        { labelKey: 'item.creation_composant', path: `${APP_BASE}/equipment/creation/composant`, action: 'create' },
        { labelKey: 'item.creation_sous_composant', path: `${APP_BASE}/equipment/creation/sous_composant`, action: 'create' }
      ]}
    ]},
    { id: 'sites', labelKey: 'menu.sites', icon: <BusinessIcon />, path: `${APP_BASE}/sites`, sections: [
      { titleKey: 'section.sites_0', items: [
        { labelKey: 'item.sites_list', path: `${APP_BASE}/sites` },
        { labelKey: 'item.sites_lines', path: `${APP_BASE}/sites/lines` },
        { labelKey: 'item.sites_map', path: `${APP_BASE}/sites/map` }
      ]}
    ]},
    // ——— Maintenance ———
    { id: 'maintenance', labelKey: 'menu.maintenance', icon: <AssignmentIcon />, path: `${APP_BASE}/work-orders`, sections: [
      { titleKey: 'section.maintenance_0', items: [
        { labelKey: 'item.my_wo_today', path: `${APP_BASE}/my-work-orders` },
        { labelKey: 'item.wo_list', path: `${APP_BASE}/work-orders` },
        { labelKey: 'item.wo_declare', path: `${APP_BASE}/work-orders/new` },
        { labelKey: 'item.intervention_requests', path: `${APP_BASE}/intervention-requests` },
        { labelKey: 'item.wo_in_progress', path: `${APP_BASE}/work-orders?status=in_progress` },
        { labelKey: 'item.wo_pending', path: `${APP_BASE}/work-orders?status=pending` }
      ]},
      { titleKey: 'section.maintenance_1', items: [
        { labelKey: 'item.planning_calendar', path: `${APP_BASE}/planning` },
        { labelKey: 'item.planning_assignments', path: `${APP_BASE}/planning/assignments` },
        { labelKey: 'item.planning_resources', path: `${APP_BASE}/planning/resources` },
        { labelKey: 'item.plans', path: `${APP_BASE}/maintenance-plans` },
        { labelKey: 'item.due', path: `${APP_BASE}/maintenance-plans/due` },
        { labelKey: 'item.projects', path: `${APP_BASE}/maintenance-projects` },
        { labelKey: 'item.checklists', path: `${APP_BASE}/checklists` },
        { labelKey: 'item.procedures', path: `${APP_BASE}/procedures` },
        { labelKey: 'item.root_causes', path: `${APP_BASE}/maintenance/root-causes` },
        { labelKey: 'item.satisfaction', path: `${APP_BASE}/maintenance/satisfaction` },
        { labelKey: 'item.planned_shutdowns', path: `${APP_BASE}/maintenance/shutdowns` },
        { labelKey: 'item.regulatory_checks', path: `${APP_BASE}/maintenance/regulatory-checks` }
      ]},
      { titleKey: 'section.maintenance_creation', items: [
        { labelKey: 'item.creation_ordre_travail', path: `${APP_BASE}/work-orders/new`, action: 'create' },
        { labelKey: 'item.creation_plan_maintenance', path: `${APP_BASE}/maintenance/creation/plan`, action: 'create' },
        { labelKey: 'item.creation_checklist', path: `${APP_BASE}/maintenance/creation/checklist`, action: 'create' }
      ]}
    ]},
    { id: 'tools', labelKey: 'menu.tools', icon: <ToolsIcon />, path: `${APP_BASE}/tools`, sections: [
      { titleKey: 'section.tools_0', items: [
        { labelKey: 'item.tools_list', path: `${APP_BASE}/tools` },
        { labelKey: 'item.tools_assignments', path: `${APP_BASE}/tools/assignments` },
        { labelKey: 'item.tools_calibrations', path: `${APP_BASE}/tools/calibrations` }
      ]},
      { titleKey: 'section.tools_creation', items: [
        { labelKey: 'item.creation_outil', path: `${APP_BASE}/tools/creation/tool`, action: 'create' },
        { labelKey: 'item.creation_assignation_outil', path: `${APP_BASE}/tools/creation/assignment`, action: 'create' }
      ]}
    ]},
    // ——— Stock & Achats ———
    { id: 'stock', labelKey: 'menu.stock', icon: <StockIcon />, path: `${APP_BASE}/stock`, sections: [
      { titleKey: 'section.stock_0', items: [
        { labelKey: 'item.stock_list', path: `${APP_BASE}/stock` },
        { labelKey: 'item.stock_movements', path: `${APP_BASE}/stock/movements` },
        { labelKey: 'item.stock_alerts', path: `${APP_BASE}/stock/alerts` },
        { labelKey: 'item.stock_locations', path: `${APP_BASE}/stock/locations` },
        { labelKey: 'item.stock_reservations', path: `${APP_BASE}/stock/reservations` },
        { labelKey: 'item.stock_warehouses', path: `${APP_BASE}/stock/warehouses` },
        { labelKey: 'item.stock_reorder_rules', path: `${APP_BASE}/stock/reorder-rules` },
        { labelKey: 'item.stock_inventories', path: `${APP_BASE}/stock/inventories` }
      ]},
      { titleKey: 'section.stock_1', items: [
        { labelKey: 'item.stock_entries', path: `${APP_BASE}/stock/entries` },
        { labelKey: 'item.stock_exits', path: `${APP_BASE}/stock/exits` },
        { labelKey: 'item.stock_transfers', path: `${APP_BASE}/stock/transfers` },
        { labelKey: 'item.stock_reorders', path: `${APP_BASE}/stock/reorders` },
        { labelKey: 'item.stock_quality', path: `${APP_BASE}/stock/quality` }
      ]},
      { titleKey: 'section.stock_creation', items: [
        { labelKey: 'item.creation_piece', path: `${APP_BASE}/stock/creation/piece`, action: 'create' },
        { labelKey: 'item.creation_entree_stock', path: `${APP_BASE}/stock/creation/entry`, action: 'create' },
        { labelKey: 'item.creation_sortie_stock', path: `${APP_BASE}/stock/creation/exit`, action: 'create' },
        { labelKey: 'item.creation_transfert_stock', path: `${APP_BASE}/stock/creation/transfer`, action: 'create' }
      ]}
    ]},
    { id: 'suppliers', labelKey: 'menu.suppliers', icon: <SupplierIcon />, path: `${APP_BASE}/suppliers`, sections: [
      { titleKey: 'section.suppliers_0', items: [
        { labelKey: 'item.suppliers_list', path: `${APP_BASE}/suppliers` },
        { labelKey: 'item.suppliers_orders', path: `${APP_BASE}/suppliers/orders` },
        { labelKey: 'item.suppliers_purchase_requests', path: `${APP_BASE}/suppliers/purchase-requests` },
        { labelKey: 'item.suppliers_price_requests', path: `${APP_BASE}/suppliers/price-requests` },
        { labelKey: 'item.suppliers_invoices', path: `${APP_BASE}/suppliers/invoices` },
        { labelKey: 'item.contracts', path: `${APP_BASE}/contracts` }
      ]},
      { titleKey: 'section.suppliers_creation', items: [
        { labelKey: 'item.creation_fournisseur', path: `${APP_BASE}/suppliers/creation/supplier`, action: 'create' },
        { labelKey: 'item.creation_commande_fournisseur', path: `${APP_BASE}/suppliers/creation/order`, action: 'create' },
        { labelKey: 'item.creation_contrat', path: `${APP_BASE}/suppliers/creation/contract`, action: 'create' }
      ]}
    ]},
    { id: 'subcontracting', labelKey: 'menu.subcontracting', icon: <SubcontractIcon />, path: `${APP_BASE}/subcontracting/contractors`, sections: [
      { titleKey: 'section.subcontracting_0', items: [
        { labelKey: 'item.external_contractors', path: `${APP_BASE}/subcontracting/contractors` },
        { labelKey: 'item.subcontract_orders', path: `${APP_BASE}/subcontracting/orders` }
      ]}
    ]},
    // ——— Budget ———
    { id: 'budget', labelKey: 'menu.budget', icon: <BudgetIcon />, path: `${APP_BASE}/budgets`, sections: [
      { titleKey: 'section.budget_0', items: [
        { labelKey: 'item.budgets_list', path: `${APP_BASE}/budgets` }
      ]}
    ]},
    // ——— Effectif & Formation ———
    { id: 'effectif', labelKey: 'menu.effectif', icon: <PeopleIcon />, path: `${APP_BASE}/technicians`, sections: [
      { titleKey: 'section.effectif_0', items: [
        { labelKey: 'item.technicians_list', path: `${APP_BASE}/technicians` },
        { labelKey: 'item.technicians_team', path: `${APP_BASE}/technicians/team` },
        { labelKey: 'item.technicians_competencies', path: `${APP_BASE}/technicians/competencies` },
        { labelKey: 'item.technicians_rules', path: `${APP_BASE}/technicians/type-competencies` }
      ]},
      { titleKey: 'section.training_0', items: [
        { labelKey: 'item.training_catalog', path: `${APP_BASE}/training/catalog` },
        { labelKey: 'item.training_plans', path: `${APP_BASE}/training/plans` }
      ]},
      { titleKey: 'section.effectif_1', items: [
        { labelKey: 'item.effectif_presence', path: `${APP_BASE}/effectif/presence` },
        { labelKey: 'item.effectif_pointage', path: `${APP_BASE}/effectif/pointage` }
      ]}
    ]},
    // ——— Rapports & Référentiels ———
    { id: 'reports', labelKey: 'menu.reports', icon: <ReportsIcon />, path: `${APP_BASE}/reports`, sections: [
      { titleKey: 'section.reports_0', items: [
        { labelKey: 'item.reports_costs', path: `${APP_BASE}/reports` },
        { labelKey: 'item.reports_availability', path: `${APP_BASE}/reports?tab=availability` },
        { labelKey: 'item.reports_mtbf_mttr', path: `${APP_BASE}/reports/mtbf-mttr` },
        { labelKey: 'item.reports_exports', path: `${APP_BASE}/reports/exports` }
      ]}
    ]},
    { id: 'decisionSupport', labelKey: 'menu.decisionSupport', icon: <LightbulbIcon />, path: `${APP_BASE}/decision-support`, sections: [
      { titleKey: 'section.decisionSupport_0', items: [
        { labelKey: 'item.decisionSupport_analysis', path: `${APP_BASE}/decision-support` }
      ]}
    ]},
    { id: 'standards', labelKey: 'menu.standards_library', icon: <MenuBookIcon />, path: `${APP_BASE}/standards`, sections: [
      { titleKey: 'section.standards_0', items: [
        { labelKey: 'item.standards_library', path: `${APP_BASE}/standards` }
      ]}
    ]},
    // ——— Données ———
    { id: 'exploitation', labelKey: 'menu.exploitation', icon: <ImportExportIcon />, path: `${APP_BASE}/exploitation/export`, sections: [
      { titleKey: 'section.exploitation_0', items: [
        { labelKey: 'item.exploitation_export', path: `${APP_BASE}/exploitation/export` },
        { labelKey: 'item.exploitation_import', path: `${APP_BASE}/exploitation/import` }
      ]}
    ]},
    // ——— Paramétrage ———
    { id: 'settings', labelKey: 'menu.settings', icon: <SettingsIcon />, path: `${APP_BASE}/settings`, sections: [
      { titleKey: 'section.settings_0', items: [
        { labelKey: 'item.settings_config', path: `${APP_BASE}/settings` },
        { labelKey: 'item.settings_alerts', path: `${APP_BASE}/settings?tab=alertes` },
        { labelKey: 'item.settings_users', path: `${APP_BASE}/users` },
        { labelKey: 'item.settings_roles', path: `${APP_BASE}/settings/roles` },
        { labelKey: 'item.settings_tenants', path: `${APP_BASE}/settings/tenants`, maintxAdminOnly: true },
        { labelKey: 'item.failure_codes', path: `${APP_BASE}/failure-codes` },
        { labelKey: 'item.part_families', path: `${APP_BASE}/catalogue/part-families` },
        { labelKey: 'item.brands', path: `${APP_BASE}/catalogue/brands` },
        { labelKey: 'item.wo_templates', path: `${APP_BASE}/catalogue/wo-templates` },
        { labelKey: 'item.email_templates', path: `${APP_BASE}/settings/email-templates` }
      ]},
      { titleKey: 'section.settings_creation', items: [
        { labelKey: 'item.creation_user', path: `${APP_BASE}/settings/creation/user`, action: 'create' },
        { labelKey: 'item.creation_failure_code', path: `${APP_BASE}/settings/creation/failure-code`, action: 'create' }
      ]}
    ]}
  ];
}

/** Catégories du menu : ordre logique pour l'UX (vue d'ensemble → actifs → maintenance → logistique → finance → effectif → analyse → données → paramétrage). */
function getMenuCategories(rawMenus) {
  const byId = (id) => rawMenus.find((m) => m.id === id);
  const categories = [
    { id: 'overview', labelKey: 'menuCategory.overview', menuIds: ['dashboard'] },
    { id: 'assets', labelKey: 'menuCategory.assets', menuIds: ['equipment', 'sites'] },
    { id: 'maintenance', labelKey: 'menuCategory.maintenance', menuIds: ['maintenance', 'tools'] },
    { id: 'logistics', labelKey: 'menuCategory.logistics', menuIds: ['stock', 'suppliers', 'subcontracting'] },
    { id: 'finance', labelKey: 'menuCategory.finance', menuIds: ['budget'] },
    { id: 'hr', labelKey: 'menuCategory.hr', menuIds: ['effectif'] },
    { id: 'analysis', labelKey: 'menuCategory.analysis', menuIds: ['reports', 'decisionSupport', 'standards'] },
    { id: 'data', labelKey: 'menuCategory.data', menuIds: ['exploitation'] },
    { id: 'settings', labelKey: 'menuCategory.settings', menuIds: ['settings'] }
  ];
  return categories
    .map((cat) => ({
      id: cat.id,
      labelKey: cat.labelKey,
      items: cat.menuIds.map(byId).filter(Boolean)
    }))
    .filter((cat) => cat.items.length > 0);
}

/** Liste plate des menus (pour currentMenuId, selectedMenu, etc.). */
function getMenuStructure(rawMenus, menuCategories) {
  return menuCategories.flatMap((c) => c.items);
}

export default function Layout() {
  const { t, i18n } = useTranslation();
  const [selectedMenuId, setSelectedMenuId] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [menuSearch, setMenuSearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [langAnchorEl, setLangAnchorEl] = useState(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [alertAnchorEl, setAlertAnchorEl] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchResults, setSearchResults] = useState({ equipment: [], workOrders: [], parts: [], technicians: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef(null);
  const searchDebounceRef = useRef(null);
  const lastPendingCountRef = useRef(-1);
  const { user, logout, permissions, can, isModuleEnabled } = useAuth();
  const snackbar = useSnackbar();

  const rawMenus = React.useMemo(() => {
    const raw = getRawMenus();
    return raw.filter((m) => {
      const resource = MENU_RESOURCE_MAP[m.id];
      if (resource && permissions?.length > 0 && !can(resource, 'view')) return false;
      const moduleCode = MENU_MODULE_MAP[m.id];
      if (moduleCode && !isModuleEnabled(moduleCode)) return false;
      return true;
    });
  }, [permissions, can, isModuleEnabled]);
  const menuCategories = React.useMemo(() => getMenuCategories(rawMenus), [rawMenus]);
  const menuStructure = React.useMemo(() => getMenuStructure(rawMenus, menuCategories), [rawMenus, menuCategories]);
  const getPathLabel = (pathSeg) => (pathSeg === '' ? t('path._home') : t(`path.${pathSeg}`));
  const getItemLabelByPath = (path) => {
    const pathOnly = path.split('?')[0];
    for (const menu of menuStructure) {
      for (const section of menu.sections) {
        for (const item of section.items) {
          if (item.path.split('?')[0] === pathOnly) return t(item.labelKey);
        }
      }
    }
    return pathOnly;
  };

  // Épingles (accès rapide) — par utilisateur, stockées en base (profil)
  const [pinnedItems, setPinnedItems] = useState([]);
  useEffect(() => {
    if (!user?.id) {
      setPinnedItems([]);
      return;
    }
    api.get('/auth/me')
      .then((r) => {
        const list = r.data?.pinnedMenuItems;
        setPinnedItems(Array.isArray(list) ? list : []);
      })
      .catch(() => setPinnedItems([]));
  }, [user?.id]);
  const isPinned = (path) => pinnedItems.some((p) => p.path === path);
  const togglePin = (item) => {
    const path = item.path;
    const next = pinnedItems.some((p) => p.path === path)
      ? pinnedItems.filter((p) => p.path !== path)
      : [...pinnedItems, { path, label: t(item.labelKey) }];
    setPinnedItems(next);
    api.put('/auth/me', { pinnedMenuItems: next }).catch(() => {
      setPinnedItems(pinnedItems);
    });
  };

  const fetchUnreadCount = () => {
    api.get('/alerts/unread-count').then((r) => setUnreadCount(r.data?.count ?? 0)).catch(() => {});
  };
  useEffect(() => { fetchUnreadCount(); }, []);

  // Alerte en temps réel : nouvelle demande d'intervention (polling + BroadcastChannel)
  useEffect(() => {
    const notifyNewInterventionRequest = () => {
      snackbar.showInfo(t('interventionRequests.alertNewRequest'));
      window.dispatchEvent(new CustomEvent('intervention-request-created'));
    };
    let channel;
    try {
      channel = new BroadcastChannel(INTERVENTION_REQUEST_CHANNEL);
      channel.onmessage = (e) => { if (e?.data?.type === 'created') notifyNewInterventionRequest(); };
    } catch (_) {}
    const poll = () => {
      api.get('/intervention-requests', { params: { status: 'pending' } })
        .then((r) => {
          const list = Array.isArray(r.data) ? r.data : [];
          const count = list.length;
          if (lastPendingCountRef.current >= 0 && count > lastPendingCountRef.current) notifyNewInterventionRequest();
          lastPendingCountRef.current = count;
        })
        .catch(() => {});
    };
    poll();
    const intervalId = setInterval(poll, PENDING_POLL_INTERVAL_MS);
    return () => {
      clearInterval(intervalId);
      try { if (channel) channel.close(); } catch (_) {}
    };
  }, [t, snackbar]);

  const openAlertsMenu = (e) => {
    setAlertAnchorEl(e.currentTarget);
    Promise.all([
      api.get('/alerts').then((r) => r.data || []).catch(() => []),
      api.get('/dashboard/alerts').then((r) => r.data || {}).catch(() => ({}))
    ]).then(([tableAlerts, dash]) => {
      // Dédupliquer les alertes table : une seule par (entity_type, entity_id)
      const seen = new Set();
      const tableDedup = (tableAlerts || []).filter((a) => {
        const key = `${a.entity_type ?? ''}-${a.entity_id ?? ''}`;
        if (!key || key === '-') return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const fromDashboard = [];
      (dash.stock || []).forEach((s) => {
        const key = `stock_alert-${s.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        fromDashboard.push({
          id: `dash-stock-${s.id}`,
          title: 'Stock sous seuil',
          message: `${s.name || s.code} : ${s.stock_quantity ?? 0} / ${s.min_stock ?? 0}`,
          entity_type: 'stock_alert',
          entity_id: s.id,
          severity: 'warning',
          is_read: 0,
          fromDashboard: true
        });
      });
      (dash.sla || []).forEach((wo) => {
        const key = `work_order-${wo.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        fromDashboard.push({
          id: `dash-sla-${wo.id}`,
          title: 'SLA dépassé',
          message: `${wo.number} — ${wo.title || ''}`,
          entity_type: 'work_order',
          entity_id: wo.id,
          severity: 'error',
          is_read: 0,
          fromDashboard: true
        });
      });
      (dash.overduePlans || []).forEach((p) => {
        const key = `maintenance_plan-${p.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        fromDashboard.push({
          id: `dash-plan-${p.id}`,
          title: 'Plan en retard',
          message: `${p.name || ''} (${p.code || ''}) — échéance ${p.next_due_date || ''}`,
          entity_type: 'maintenance_plan',
          entity_id: p.id,
          severity: 'warning',
          is_read: 0,
          fromDashboard: true
        });
      });
      setAlerts([...tableDedup, ...fromDashboard]);
    });
  };
  const markAlertRead = (id) => {
    if (String(id).startsWith('dash-')) return;
    api.put(`/alerts/${id}/read`).then(() => {
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: 1 } : a)));
      fetchUnreadCount();
    }).catch(() => {});
  };
  const markAllRead = () => {
    api.put('/alerts/read-all').then(() => {
      setAlerts((prev) => prev.map((a) => (a.fromDashboard ? a : { ...a, is_read: 1 })));
      setUnreadCount(0);
    }).catch(() => {});
  };
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isDark = false; // Mode clair uniquement

  // Déterminer le menu sélectionné basé sur la route actuelle (pathname + chemins des sous-items).
  // Priorité : correspondance exacte du chemin du menu (évite qu'un lien commun comme /creation ouvre le mauvais menu).
  const currentMenuId = useMemo(() => {
    const pathname = location.pathname;
    for (const menu of menuStructure) {
      if (pathname === menu.path) return menu.id;
    }
    let bestMenuId = null;
    let bestPathLen = 0;
    for (const menu of menuStructure) {
      if (pathname.startsWith(menu.path + '/')) {
        if (menu.path.length >= bestPathLen) {
          bestMenuId = menu.id;
          bestPathLen = menu.path.length;
        }
      }
      for (const section of menu.sections) {
        for (const item of section.items) {
          const itemPath = item.path.split('?')[0];
          if (pathname === itemPath || pathname.startsWith(itemPath + '/')) {
            if (itemPath.length >= bestPathLen) {
              bestMenuId = menu.id;
              bestPathLen = itemPath.length;
            }
          }
        }
      }
    }
    return bestMenuId || menuStructure[0]?.id || null;
  }, [location.pathname]);

  // Initialiser le menu sélectionné et les sections expansées
  React.useEffect(() => {
    if (currentMenuId) {
      if (!selectedMenuId || selectedMenuId !== currentMenuId) {
        setSelectedMenuId(currentMenuId);
      }
      const menu = menuStructure.find(m => m.id === currentMenuId);
      if (menu) {
        const expanded = {};
        menu.sections.forEach((_, index) => {
          expanded[`${currentMenuId}-${index}`] = true;
        });
        setExpandedSections(expanded);
      }
    }
  }, [currentMenuId]);

  const handleMenuClick = (menuId) => {
    setSelectedMenuId(menuId);
    setDetailPanelOpen(true);
    const menu = menuStructure.find(m => m.id === menuId);
    if (menu) {
      // Ne pas naviguer ici : afficher uniquement le panneau des sous-menus.
      // La navigation se fait au clic sur un sous-élément.
      const expanded = {};
      menu.sections.forEach((_, index) => {
        expanded[`${menuId}-${index}`] = true;
      });
      setExpandedSections(expanded);
    }
  };

  const toggleSection = (sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const expandAll = () => {
    if (!selectedMenuId) return;
    const menu = menuStructure.find(m => m.id === selectedMenuId);
    if (menu) {
      const expanded = {};
      menu.sections.forEach((_, index) => {
        expanded[`${selectedMenuId}-${index}`] = true;
      });
      setExpandedSections(expanded);
    }
  };

  const collapseAll = () => {
    if (!selectedMenuId) return;
    const menu = menuStructure.find(m => m.id === selectedMenuId);
    if (menu) {
      const expanded = {};
      menu.sections.forEach((_, index) => {
        expanded[`${selectedMenuId}-${index}`] = false;
      });
      setExpandedSections(expanded);
    }
  };

  const selectedMenu = menuStructure.find(m => m.id === selectedMenuId);

  // Ne pas filtrer les menus principaux par la recherche : la recherche ne s'applique qu'aux items du sous-menu ouvert.
  // Filtrer uniquement les items dans les sections du sous-menu selon la recherche
  const filterItems = (items) => {
    if (!menuSearch) return items;
    return items.filter(item =>
      t(item.labelKey).toLowerCase().includes(menuSearch.toLowerCase())
    );
  };

  const searchOpen = globalSearch.trim().length >= 2;
  useEffect(() => {
    const q = globalSearch.trim();
    if (q.length < 2) {
      setSearchResults({ equipment: [], workOrders: [], parts: [], technicians: [] });
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearchLoading(true);
      api.get('/search', { params: { q } })
        .then((r) => setSearchResults(r.data || { equipment: [], workOrders: [], parts: [], technicians: [] }))
        .catch(() => setSearchResults({ equipment: [], workOrders: [], parts: [], technicians: [] }))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [globalSearch]);

  const handleSearchResultClick = useCallback((path) => {
    navigate(path);
    setGlobalSearch('');
  }, [navigate]);

  const hasSearchResults = searchResults.equipment?.length > 0 || searchResults.workOrders?.length > 0 ||
    searchResults.parts?.length > 0 || searchResults.technicians?.length > 0;

  useEffect(() => {
    const handleKeyDown = (e) => {
      const inInput = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.getAttribute('contenteditable') === 'true';
      if (e.key === 'Escape') {
        setAnchorEl(null);
        setLangAnchorEl(null);
        setAlertAnchorEl(null);
        setGlobalSearch('');
        return;
      }
      if (e.key === '/' && !inInput) {
        e.preventDefault();
        searchInputRef.current?.querySelector('input')?.focus();
        return;
      }
      if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !inInput) {
        e.preventDefault();
        navigate('/app/work-orders/new');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Header épuré : fond clair, bordure basse, logo simple */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: '#fff',
          color: 'text.primary',
          minHeight: 56,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Toolbar sx={{ gap: 2, minHeight: '56px !important', px: 2 }}>
          {/* Marque MAINTX — cliquable vers tableau de bord */}
          <Box
            component={RouterLink}
            to="/app"
            sx={{
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'opacity 0.2s ease',
              '&:hover': { opacity: 0.85 }
            }}
          >
            <Typography
              component="span"
              sx={{
                fontWeight: 700,
                fontSize: '1.25rem',
                letterSpacing: '0.02em',
                color: 'text.primary'
              }}
            >
              MAIN
            </Typography>
            <Typography
              component="span"
              sx={{
                fontWeight: 700,
                fontSize: '1.25rem',
                letterSpacing: '0.02em',
                color: 'primary.main'
              }}
            >
              TX
            </Typography>
          </Box>

          {/* Recherche globale */}
          <Box sx={{ flex: 1, maxWidth: 520 }} ref={searchInputRef}>
            <TextField
              fullWidth
              size="small"
              placeholder={t('common.searchPlaceholder')}
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                sx: {
                  bgcolor: 'action.hover',
                  borderRadius: 1.5,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'divider'
                  }
                }
              }}
            />
            <Popper
              open={searchOpen}
              anchorEl={searchInputRef.current}
              placement="bottom-start"
              style={{ zIndex: 1400, width: searchInputRef.current?.offsetWidth || 520 }}
            >
              <Paper elevation={8} sx={{ mt: 0.5, maxHeight: 400, overflow: 'auto' }}>
                {searchLoading ? (
                  <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} /></Box>
                ) : (
                  <>
                    {searchResults.equipment?.length > 0 && (
                      <Box sx={{ py: 1 }}>
                        <Typography variant="caption" sx={{ px: 2, color: 'text.secondary', fontWeight: 600 }}>{t('menu.equipment')}</Typography>
                        {searchResults.equipment.map((r) => (
                          <ListItemButton key={`eq-${r.id}`} onClick={() => handleSearchResultClick(`/equipment/${r.id}`)}>
                            <ListItemText primary={`${r.code} — ${r.name}`} primaryTypographyProps={{ variant: 'body2' }} />
                          </ListItemButton>
                        ))}
                      </Box>
                    )}
                    {searchResults.workOrders?.length > 0 && (
                      <Box sx={{ py: 1 }}>
                        <Typography variant="caption" sx={{ px: 2, color: 'text.secondary', fontWeight: 600 }}>{t('path.work-orders')}</Typography>
                        {searchResults.workOrders.map((r) => (
                          <ListItemButton key={`wo-${r.id}`} onClick={() => handleSearchResultClick(`/work-orders/${r.id}`)}>
                            <ListItemText primary={`${r.number} — ${r.title || ''}`} primaryTypographyProps={{ variant: 'body2' }} />
                          </ListItemButton>
                        ))}
                      </Box>
                    )}
                    {searchResults.parts?.length > 0 && (
                      <Box sx={{ py: 1 }}>
                        <Typography variant="caption" sx={{ px: 2, color: 'text.secondary', fontWeight: 600 }}>{t('path.stock')}</Typography>
                        {searchResults.parts.map((r) => (
                          <ListItemButton key={`p-${r.id}`} onClick={() => handleSearchResultClick('/stock')}>
                            <ListItemText primary={`${r.code} — ${r.name}`} primaryTypographyProps={{ variant: 'body2' }} />
                          </ListItemButton>
                        ))}
                      </Box>
                    )}
                    {searchResults.technicians?.length > 0 && (
                      <Box sx={{ py: 1 }}>
                        <Typography variant="caption" sx={{ px: 2, color: 'text.secondary', fontWeight: 600 }}>{t('menu.effectif')}</Typography>
                        {searchResults.technicians.map((r) => (
                          <ListItemButton key={`t-${r.id}`} onClick={() => handleSearchResultClick(`/technicians/${r.id}`)}>
                            <ListItemText primary={`${r.firstName} ${r.lastName}`} secondary={r.email} primaryTypographyProps={{ variant: 'body2' }} />
                          </ListItemButton>
                        ))}
                      </Box>
                    )}
                    {!searchLoading && !hasSearchResults && globalSearch.trim().length >= 2 && (
                      <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>Aucun résultat</Typography>
                    )}
                  </>
                )}
              </Paper>
            </Popper>
          </Box>

          {/* Partie droite du header : langue, notifications, aide, favoris, nom utilisateur, avatar */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              ml: 'auto',
              flexShrink: 0
            }}
          >
            <Typography
              component="button"
              type="button"
              onClick={(e) => setLangAnchorEl(e.currentTarget)}
              aria-label={t('common.language')}
              sx={{
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'text.secondary',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                px: 0,
                py: 0.5,
                '&:hover': { color: 'text.primary' }
              }}
            >
              {LANGUAGES.find((l) => l.code === i18n.language)?.code?.toUpperCase() || 'FR'}
            </Typography>
            <IconButton
              size="small"
              onClick={openAlertsMenu}
              aria-label={t('common.notifications')}
              sx={{ color: 'text.secondary', '&:hover': { bgcolor: 'action.hover', color: 'text.primary' } }}
            >
              <Badge badgeContent={unreadCount} color="error">
                <NotificationsIcon fontSize="small" />
              </Badge>
            </IconButton>
            <IconButton
              size="small"
              aria-label={t('common.help', 'Aide')}
              sx={{ color: 'text.secondary', '&:hover': { bgcolor: 'action.hover', color: 'text.primary' } }}
            >
              <Help fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              aria-label={t('common.favorites', 'Favoris')}
              sx={{ color: 'text.secondary', '&:hover': { bgcolor: 'action.hover', color: 'text.primary' } }}
            >
              <Star fontSize="small" />
            </IconButton>
            <Box
              component="button"
              type="button"
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                border: 'none',
                borderRadius: 1,
                py: 0.75,
                px: 1.25,
                bgcolor: 'action.hover',
                color: 'text.primary',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.875rem',
                '&:hover': { bgcolor: 'action.selected' }
              }}
            >
              <Typography component="span" variant="body2" sx={{ fontWeight: 500 }}>
                {(user?.username || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.role || 'Utilisateur').toLowerCase()}
              </Typography>
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: 'primary.main',
                  fontSize: '0.875rem'
                }}
              >
                {(user?.firstName?.[0] || '') + (user?.lastName?.[0] || user?.username?.[0] || '')}
              </Avatar>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sous-header : accès rapide aux entrées épinglées (par profil) */}
      {pinnedItems.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            minHeight: 40,
            bgcolor: 'action.hover',
            borderBottom: '1px solid',
            borderColor: 'divider',
            flexWrap: 'wrap'
          }}
        >
          {pinnedItems.map((p) => (
            <Chip
              key={p.path}
              component={RouterLink}
              to={p.path}
              label={getItemLabelByPath(p.path)}
              size="small"
              icon={<Star sx={{ fontSize: 16, color: 'primary.main' }} />}
              onDelete={() => togglePin(p)}
              sx={{
                '& .MuiChip-icon': { color: 'primary.main' },
                fontWeight: 500
              }}
            />
          ))}
        </Box>
      )}

      {/* Menu utilisateur */}
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem disabled>
          <Typography variant="body2" fontWeight={600}>
            {user?.firstName} {user?.lastName}
          </Typography>
        </MenuItem>
        <MenuItem disabled>
          <Typography variant="caption" color="text.secondary">
            {user?.role}
          </Typography>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            logout();
            navigate('/login');
          }}
        >
          <Logout fontSize="small" sx={{ mr: 1 }} />
          {t('common.logout')}
        </MenuItem>
      </Menu>

      {/* Menu Langue */}
      <Menu
        anchorEl={langAnchorEl}
        open={!!langAnchorEl}
        onClose={() => setLangAnchorEl(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {LANGUAGES.map((lang) => (
          <MenuItem
            key={lang.code}
            selected={i18n.language === lang.code}
            onClick={() => { i18n.changeLanguage(lang.code); setLangAnchorEl(null); }}
          >
            <Box component="span" sx={{ mr: 1.5, fontSize: '1.25rem' }}>{lang.flag}</Box>
            {lang.label}
          </MenuItem>
        ))}
      </Menu>

      {/* Menu Notifications */}
      <Menu
        anchorEl={alertAnchorEl}
        open={!!alertAnchorEl}
        onClose={() => setAlertAnchorEl(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{ sx: { minWidth: 320, maxHeight: 400 } }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {t('common.notifications')}
          </Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={markAllRead}>
              {t('common.markAllRead')}
            </Button>
          )}
        </Box>
        <Divider />
        {alerts.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">{t('common.noNotifications')}</Typography>
          </MenuItem>
        ) : (
          alerts.slice(0, 20).map((alert) => (
            <MenuItem
              key={alert.id}
              onClick={() => {
                if (!alert.fromDashboard && !alert.is_read) markAlertRead(alert.id);
                setAlertAnchorEl(null);
                if (alert.entity_type === 'work_order' && alert.entity_id) navigate(`/app/work-orders/${alert.entity_id}`);
                if (alert.entity_type === 'stock_alert') navigate('/app/stock/alerts');
                if (alert.entity_type === 'maintenance_plan' && alert.entity_id) navigate('/app/maintenance-plans/due');
              }}
              sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 1.5 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {alert.severity === 'warning' || alert.severity === 'error' ? (
                    <WarningIcon color={alert.severity === 'error' ? 'error' : 'warning'} fontSize="small" />
                  ) : (
                    <InfoIcon color="info" fontSize="small" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={alert.title}
                  secondary={alert.message}
                  primaryTypographyProps={{ fontWeight: alert.is_read ? 400 : 600, variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                />
                {!alert.is_read && <Chip label={t('common.new')} size="small" color="primary" sx={{ ml: 'auto' }} />}
              </Box>
            </MenuItem>
          ))
        )}
      </Menu>

      {/* Contenu principal avec menu gauche et panneau détaillé */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Menu vertical gauche - moderne et dynamique */}
        <Paper
          elevation={0}
          sx={{
            width: menuCollapsed ? 72 : 260,
            minWidth: menuCollapsed ? 72 : 260,
            flexShrink: 0,
            bgcolor: isDark ? alpha(theme.palette.background.paper, 0.95) : 'white',
            borderRight: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'width 0.28s ease',
            boxShadow: isDark ? 'none' : '2px 0 12px rgba(0,0,0,0.04)'
          }}
        >
          <Box
            sx={{
              p: 2,
              minHeight: 56,
              display: 'flex',
              alignItems: 'center',
              justifyContent: menuCollapsed ? 'center' : 'space-between',
              borderBottom: '1px solid',
              borderColor: 'divider'
            }}
          >
            {!menuCollapsed && (
              <Typography variant="h6" fontWeight={700} sx={{ color: 'text.primary' }}>
                {t('common.menu')}
              </Typography>
            )}
            <IconButton
              size="small"
              onClick={() => setMenuCollapsed(!menuCollapsed)}
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.15) }
              }}
            >
              {menuCollapsed ? <ChevronRight /> : <MenuOpen />}
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <List disablePadding sx={{ py: 1, px: 1 }}>
              {menuCategories.map((category) => (
                <Box key={category.id} sx={{ mb: 2 }}>
                  {!menuCollapsed && (
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        px: 2,
                        py: 0.75,
                        fontWeight: 700,
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em'
                      }}
                    >
                      {t(category.labelKey)}
                    </Typography>
                  )}
                  {category.items.map((menu) => {
                    const isSelected = selectedMenuId === menu.id;
                    return (
                      <ListItemButton
                        key={menu.id}
                        onClick={() => handleMenuClick(menu.id)}
                        sx={{
                          borderRadius: 2,
                          mb: 0.5,
                          bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.15) : 'transparent',
                          color: isSelected ? 'primary.main' : 'text.primary',
                          px: menuCollapsed ? 2 : 2,
                          py: 1.25,
                          justifyContent: menuCollapsed ? 'center' : 'flex-start',
                          '&:hover': {
                            bgcolor: isSelected
                              ? alpha(theme.palette.primary.main, 0.2)
                              : alpha(theme.palette.primary.main, 0.06)
                          },
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Box sx={{ color: 'inherit', display: 'flex', alignItems: 'center', minWidth: 28 }}>
                          {menu.icon}
                        </Box>
                        {!menuCollapsed && (
                          <ListItemText
                            primary={t(menu.labelKey)}
                            primaryTypographyProps={{
                              fontWeight: isSelected ? 600 : 500,
                              fontSize: '0.9rem'
                            }}
                            sx={{ ml: 1.5 }}
                          />
                        )}
                      </ListItemButton>
                    );
                  })}
                </Box>
              ))}
            </List>
          </Box>
        </Paper>

        {/* Modal des sous-menus du menu sélectionné */}
        <Dialog
          open={!!(selectedMenu && detailPanelOpen)}
          onClose={() => setDetailPanelOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              maxHeight: '85vh'
            }
          }}
          TransitionProps={{
            onEntered: () => {
              const dialog = document.querySelector('[role="dialog"]');
              const focusable = dialog?.querySelector('a[href], button:not([disabled])');
              if (focusable) focusable.focus();
            }
          }}
        >
          {selectedMenu && (
            <>
              <DialogTitle
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  py: 2
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ color: 'primary.main' }}>{selectedMenu.icon}</Box>
                  <Typography variant="h6" fontWeight={700}>
                    {t(selectedMenu.labelKey)}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => setDetailPanelOpen(false)} aria-label={t('common.cancel')}>
                  <Close />
                </IconButton>
              </DialogTitle>
              <DialogContent sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <TextField
                    size="small"
                    placeholder={t('common.searchPlaceholder')}
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search />
                        </InputAdornment>
                      )
                    }}
                    sx={{ flex: 1, minWidth: 200 }}
                  />
                  <Button variant="outlined" size="small" onClick={collapseAll} sx={{ textTransform: 'none' }}>
                    {t('common.collapseAll')}
                  </Button>
                  <Button variant="outlined" size="small" onClick={expandAll} sx={{ textTransform: 'none' }}>
                    {t('common.expandAll')}
                  </Button>
                </Box>
                <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                  {selectedMenu.sections.map((section, sectionIndex) => {
                    const sectionKey = `${selectedMenuId}-${sectionIndex}`;
                    const isExpanded = expandedSections[sectionKey] !== false;
                    const menuResource = selectedMenuId ? MENU_RESOURCE_MAP[selectedMenuId] : null;
                    const filteredSectionItems = filterItems(section.items)
                      .filter((item) => !(item.maintxAdminOnly && !user?.isAdmin))
                      .filter((item) => {
                        const resource = item.resource ?? menuResource;
                        const action = item.action ?? 'view';
                        return resource && can(resource, action);
                      });

                    if (filteredSectionItems.length === 0) return null;

                    return (
                      <Box key={sectionIndex} sx={{ mb: 2.5 }}>
                        <Box
                          onClick={() => toggleSection(sectionKey)}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            cursor: 'pointer',
                            mb: 1,
                            '&:hover': { opacity: 0.8 }
                          }}
                        >
                          {isExpanded ? (
                            <ExpandLess sx={{ color: 'primary.main' }} />
                          ) : (
                            <ExpandMore sx={{ color: 'primary.main' }} />
                          )}
                          <Typography variant="subtitle1" fontWeight={700} sx={{ color: 'text.primary' }}>
                            {t(section.titleKey)}
                          </Typography>
                        </Box>
                        <Collapse in={isExpanded}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, ml: 2 }}>
                            {filteredSectionItems.map((item, itemIndex) => {
                              const itemPathOnly = item.path.split('?')[0];
                              const itemSearch = item.path.includes('?') ? item.path.slice(item.path.indexOf('?')) : '';
                              const isActive = location.pathname === itemPathOnly && (itemSearch ? location.search === itemSearch : !location.search);
                              const pinned = isPinned(item.path);
                              return (
                                <Box
                                  key={itemIndex}
                                  onClick={() => {
                                    navigate(item.path);
                                    setMenuSearch('');
                                    setDetailPanelOpen(false);
                                  }}
                                  sx={{
                                    p: 1.25,
                                    pl: 1,
                                    borderRadius: 1.5,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    bgcolor: isActive ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
                                    border: '1px solid',
                                    borderColor: isActive ? 'primary.main' : 'transparent',
                                    '&:hover': {
                                      bgcolor: alpha(theme.palette.primary.main, 0.06),
                                      borderColor: 'primary.main'
                                    },
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      togglePin(item);
                                    }}
                                    sx={{ p: 0.25 }}
                                    aria-label={pinned ? t('common.unpin') : t('common.pin')}
                                  >
                                    {pinned ? (
                                      <Star fontSize="small" sx={{ color: 'primary.main' }} />
                                    ) : (
                                      <StarBorder fontSize="small" sx={{ color: 'text.secondary' }} />
                                    )}
                                  </IconButton>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      flex: 1,
                                      color: isActive ? 'primary.main' : 'text.secondary',
                                      fontWeight: isActive ? 600 : 400
                                    }}
                                  >
                                    {t(item.labelKey)}
                                  </Typography>
                                </Box>
                              );
                            })}
                          </Box>
                        </Collapse>
                      </Box>
                    );
                  })}
                </Box>
              </DialogContent>
            </>
          )}
        </Dialog>

        {/* Zone de contenu principal */}
        <Box
          component="main"
          sx={{
            flex: 1,
            overflow: 'auto',
            bgcolor: isDark ? alpha(theme.palette.background.default, 0.6) : alpha('#f8fafc', 0.9),
            transition: 'all 0.3s ease'
          }}
        >
          <Box sx={{ p: 3 }}>
            <Breadcrumbs sx={{ mb: 2 }} aria-label="Breadcrumb">
              <Link component={RouterLink} to="/app" underline="hover" color="inherit" sx={{ fontSize: '0.875rem' }}>
                {t('common.home')}
              </Link>
              {(() => {
                const isApp = location.pathname.startsWith('/app');
                const segments = isApp
                  ? location.pathname.replace(/^\/app\/?/, '').split('/').filter(Boolean)
                  : location.pathname.split('/').filter(Boolean);
                const basePath = isApp ? '/app' : '';
                return segments.map((segment, i, arr) => {
                  const path = arr.slice(0, i + 1).join('/');
                  const pathKey = `path.${path}`;
                  const segmentKey = `path.${segment}`;
                  const translatedPath = t(pathKey);
                  const translatedSegment = t(segmentKey);
                  const isId = /^\d+$/.test(segment) || /^[0-9a-f-]{20,}$/i.test(segment);
                  const label = path
                    ? (translatedPath && translatedPath !== pathKey
                      ? translatedPath
                      : isId
                        ? t('path._detail')
                        : (translatedSegment && translatedSegment !== segmentKey ? translatedSegment : t('path._unknown')))
                    : t('path._home');
                  const isLast = i === arr.length - 1;
                  const linkTo = basePath ? `${basePath}/${path}` : `/${path}`;
                  return isLast ? (
                    <Typography key={path} color="text.primary" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                      {label}
                    </Typography>
                  ) : (
                    <Link key={path} component={RouterLink} to={linkTo} underline="hover" color="inherit" sx={{ fontSize: '0.875rem' }}>
                      {label}
                    </Link>
                  );
                });
              })()}
            </Breadcrumbs>
            <Suspense fallback={
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                <CircularProgress />
              </Box>
            }>
              <Outlet />
            </Suspense>
          </Box>
        </Box>

        {/* Barre d'actions à droite : toujours affichée, l'utilisateur peut l'épingler ou la masquer */}
        <ActionBar />
      </Box>
    </Box>
  );
}
