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
  CircularProgress
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
  Info as InfoIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { ActionBar } from '../context/ActionPanelContext';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import api from '../services/api';
import { LogoCompact } from './Logo';
import { LANGUAGES } from '../constants/languages';

function getMenuStructure() {
  return [
    { id: 'dashboard', labelKey: 'menu.dashboard', icon: <DashboardIcon />, path: '/', sections: [
      { titleKey: 'section.dashboard_0', items: [
        { labelKey: 'item.dashboard_overview', path: '/' },
        { labelKey: 'item.dashboard_kpis', path: '/dashboard/kpis' },
        { labelKey: 'item.dashboard_activity', path: '/dashboard/activity' }
      ]}
    ]},
    { id: 'creation', labelKey: 'menu.creation', icon: <BusinessIcon />, path: '/creation', sections: [
      { titleKey: 'section.creation_0', items: [{ labelKey: 'item.creation_new', path: '/creation' }] }
    ]},
    { id: 'equipment', labelKey: 'menu.equipment', icon: <BuildIcon />, path: '/equipment', sections: [
      { titleKey: 'section.equipment_0', items: [
        { labelKey: 'item.equipment_list', path: '/equipment' },
        { labelKey: 'item.equipment_map', path: '/equipment/map' },
        { labelKey: 'item.equipment_categories', path: '/equipment/categories' },
        { labelKey: 'item.equipment_technical', path: '/equipment/technical' }
      ]},
      { titleKey: 'section.equipment_1', items: [
        { labelKey: 'item.management_history', path: '/equipment' },
        { labelKey: 'item.management_documents', path: '/equipment' },
        { labelKey: 'item.management_warranties', path: '/equipment' }
      ]}
    ]},
    { id: 'maintenance', labelKey: 'menu.maintenance', icon: <AssignmentIcon />, path: '/work-orders', sections: [
      { titleKey: 'section.maintenance_0', items: [
        { labelKey: 'item.wo_list', path: '/work-orders' },
        { labelKey: 'item.wo_declare', path: '/creation' },
        { labelKey: 'item.intervention_requests', path: '/intervention-requests' },
        { labelKey: 'item.wo_in_progress', path: '/work-orders?status=in_progress' },
        { labelKey: 'item.wo_pending', path: '/work-orders?status=pending' }
      ]},
      { titleKey: 'section.maintenance_1', items: [
        { labelKey: 'item.plans', path: '/maintenance-plans' },
        { labelKey: 'item.checklists', path: '/checklists' },
        { labelKey: 'item.due', path: '/maintenance-plans/due' }
      ]},
      { titleKey: 'section.maintenance_2', items: [
        { labelKey: 'item.planning_calendar', path: '/planning' },
        { labelKey: 'item.planning_assignments', path: '/planning/assignments' },
        { labelKey: 'item.planning_resources', path: '/planning/resources' }
      ]}
    ]},
    { id: 'stock', labelKey: 'menu.stock', icon: <StockIcon />, path: '/stock', sections: [
      { titleKey: 'section.stock_0', items: [
        { labelKey: 'item.stock_list', path: '/stock' },
        { labelKey: 'item.stock_movements', path: '/stock/movements' },
        { labelKey: 'item.stock_inventories', path: '/stock/inventories' },
        { labelKey: 'item.stock_alerts', path: '/stock/alerts' }
      ]},
      { titleKey: 'section.stock_1', items: [
        { labelKey: 'item.stock_entries', path: '/stock/entries' },
        { labelKey: 'item.stock_exits', path: '/stock/exits' },
        { labelKey: 'item.stock_transfers', path: '/stock/transfers' },
        { labelKey: 'item.stock_reorders', path: '/stock/reorders' }
      ]}
    ]},
    { id: 'suppliers', labelKey: 'menu.suppliers', icon: <SupplierIcon />, path: '/suppliers', sections: [
      { titleKey: 'section.suppliers_0', items: [
        { labelKey: 'item.suppliers_list', path: '/suppliers' },
        { labelKey: 'item.contracts', path: '/contracts' },
        { labelKey: 'item.suppliers_orders', path: '/suppliers/orders' }
      ]}
    ]},
    { id: 'tools', labelKey: 'menu.tools', icon: <ToolsIcon />, path: '/tools', sections: [
      { titleKey: 'section.tools_0', items: [
        { labelKey: 'item.tools_list', path: '/tools' },
        { labelKey: 'item.tools_assignments', path: '/tools/assignments' },
        { labelKey: 'item.tools_calibrations', path: '/tools/calibrations' }
      ]}
    ]},
    { id: 'reports', labelKey: 'menu.reports', icon: <ReportsIcon />, path: '/reports', sections: [
      { titleKey: 'section.reports_0', items: [
        { labelKey: 'item.reports_costs', path: '/reports' },
        { labelKey: 'item.reports_availability', path: '/reports?tab=availability' },
        { labelKey: 'item.reports_exports', path: '/reports/exports' }
      ]}
    ]},
    { id: 'sites', labelKey: 'menu.sites', icon: <BusinessIcon />, path: '/sites', sections: [
      { titleKey: 'section.sites_0', items: [
        { labelKey: 'item.sites_list', path: '/sites' },
        { labelKey: 'item.sites_lines', path: '/sites/lines' },
        { labelKey: 'item.sites_map', path: '/sites/map' }
      ]}
    ]},
    { id: 'effectif', labelKey: 'menu.effectif', icon: <PeopleIcon />, path: '/technicians', sections: [
      { titleKey: 'section.effectif_0', items: [
        { labelKey: 'item.technicians_list', path: '/technicians' },
        { labelKey: 'item.technicians_competencies', path: '/technicians/competencies' },
        { labelKey: 'item.technicians_rules', path: '/technicians/type-competencies' },
        { labelKey: 'item.technicians_team', path: '/technicians/team' }
      ]}
    ]},
    { id: 'settings', labelKey: 'menu.settings', icon: <SettingsIcon />, path: '/settings', sections: [
      { titleKey: 'section.settings_0', items: [
        { labelKey: 'item.settings_config', path: '/settings' },
        { labelKey: 'item.settings_alerts', path: '/settings?tab=alertes' },
        { labelKey: 'item.settings_users', path: '/users' },
        { labelKey: 'item.settings_roles', path: '/settings/roles' }
      ]}
    ]}
  ];
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
  const { user, logout } = useAuth();

  const menuStructure = React.useMemo(() => getMenuStructure(), []);
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

  // Déterminer le menu sélectionné basé sur la route actuelle (pathname + chemins des sous-items)
  const currentMenuId = useMemo(() => {
    const pathname = location.pathname;
    let bestMenuId = null;
    let bestPathLen = 0;
    for (const menu of menuStructure) {
      if (pathname === menu.path || pathname.startsWith(menu.path + '/')) {
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
        setDetailPanelOpen(true);
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
      navigate(menu.path);
      // Développer toutes les sections par défaut
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

  // Filtrer les menus selon la recherche
  const filteredMenus = menuStructure.filter(menu =>
    t(menu.labelKey).toLowerCase().includes(menuSearch.toLowerCase())
  );

  // Filtrer les items dans les sections selon la recherche
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
        navigate('/work-orders/new');
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
          {/* Logo maintx — cliquable vers accueil */}
          <Box
            component={RouterLink}
            to="/"
            sx={{
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'opacity 0.2s ease',
              '&:hover': { opacity: 0.85 }
            }}
          >
            <LogoCompact variant="dark" size={36} />
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

          {/* Infos utilisateur et icônes */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={(e) => setLangAnchorEl(e.currentTarget)}
              aria-label={t('common.language')}
              sx={{ fontSize: '1.25rem' }}
            >
              {LANGUAGES.find((l) => l.code === i18n.language)?.flag || '🌐'}
            </IconButton>
            <IconButton
              size="small"
              onClick={openAlertsMenu}
              aria-label={t('common.notifications')}
            >
              <Badge badgeContent={unreadCount} color="error">
                <NotificationsIcon fontSize="small" />
              </Badge>
            </IconButton>
            <IconButton size="small">
              <Help fontSize="small" />
            </IconButton>
            <IconButton size="small">
              <Star fontSize="small" />
            </IconButton>
            <Chip
              label={user?.role || 'Utilisateur'}
              size="small"
              sx={{ bgcolor: 'action.selected', color: 'text.primary', height: 28, fontWeight: 500 }}
            />
            <IconButton
              onClick={(e) => setAnchorEl(e.currentTarget)}
              size="small"
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: 'primary.main',
                  fontSize: '0.875rem'
                }}
              >
                {(user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')}
              </Avatar>
            </IconButton>
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
                if (alert.entity_type === 'work_order' && alert.entity_id) navigate(`/work-orders/${alert.entity_id}`);
                if (alert.entity_type === 'stock_alert') navigate('/stock/alerts');
                if (alert.entity_type === 'maintenance_plan' && alert.entity_id) navigate('/maintenance-plans/due');
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
              {filteredMenus.map((menu) => {
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
            </List>
          </Box>
        </Paper>

        {/* Panneau détaillé à droite - moderne */}
        {selectedMenu && detailPanelOpen && (
          <Paper
            elevation={0}
            sx={{
              width: 380,
              flexShrink: 0,
              bgcolor: isDark ? alpha(theme.palette.background.paper, 0.98) : 'white',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderLeft: '1px solid',
              borderColor: 'divider',
              boxShadow: isDark ? '-4px 0 24px rgba(0,0,0,0.3)' : '-4px 0 20px rgba(0,0,0,0.06)',
              transition: 'all 0.3s ease'
            }}
          >
            {/* Header du panneau détaillé */}
            <Box
              sx={{
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 2
              }}
            >
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
                sx={{ flex: 1, maxWidth: 400 }}
              />
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={collapseAll}
                  sx={{
                    bgcolor: '#2EB23E',
                    '&:hover': { bgcolor: '#259633' },
                    textTransform: 'none',
                    px: 2
                  }}
                >
                  {t('common.collapseAll')}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={expandAll}
                  sx={{
                    bgcolor: '#2EB23E',
                    '&:hover': { bgcolor: '#259633' },
                    textTransform: 'none',
                    px: 2
                  }}
                >
                  {t('common.expandAll')}
                </Button>
                <IconButton
                  size="small"
                  onClick={() => setDetailPanelOpen(false)}
                  sx={{ ml: 1 }}
                >
                  <Close />
                </IconButton>
              </Box>
            </Box>

            {/* Contenu du panneau détaillé */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
              {selectedMenu.sections.map((section, sectionIndex) => {
                const sectionKey = `${selectedMenuId}-${sectionIndex}`;
                const isExpanded = expandedSections[sectionKey] !== false;
                const filteredSectionItems = filterItems(section.items);

                if (filteredSectionItems.length === 0) return null;

                return (
                  <Box key={sectionIndex} sx={{ mb: 3 }}>
                    {/* Titre de section avec bouton expand/collapse */}
                    <Box
                      onClick={() => toggleSection(sectionKey)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        cursor: 'pointer',
                        mb: 1.5,
                        '&:hover': { opacity: 0.8 }
                      }}
                    >
                      {isExpanded ? (
                        <ExpandLess sx={{ color: '#2EB23E' }} />
                      ) : (
                        <ExpandMore sx={{ color: '#2EB23E' }} />
                      )}
                      <Typography
                        variant="h6"
                        fontWeight={700}
                        sx={{ color: 'text.primary', fontSize: '1.05rem' }}
                      >
                        {t(section.titleKey)}
                      </Typography>
                    </Box>

                    {/* Items de la section en colonnes */}
                    <Collapse in={isExpanded}>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                          gap: 1.5,
                          ml: 3
                        }}
                      >
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
                              }}
                              sx={{
                                p: 1.5,
                                pl: 1,
                                borderRadius: 1.5,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                bgcolor: isActive
                                  ? alpha(theme.palette.primary.main, 0.12)
                                  : 'transparent',
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
          </Paper>
        )}

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
              <Link component={RouterLink} to="/" underline="hover" color="inherit" sx={{ fontSize: '0.875rem' }}>
                {t('common.home')}
              </Link>
              {location.pathname.split('/').filter(Boolean).map((segment, i, arr) => {
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
                return isLast ? (
                  <Typography key={path} color="text.primary" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                    {label}
                  </Typography>
                ) : (
                  <Link key={path} component={RouterLink} to={`/${path}`} underline="hover" color="inherit" sx={{ fontSize: '0.875rem' }}>
                    {label}
                  </Link>
                );
              })}
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
