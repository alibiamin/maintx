import React, { useState, useMemo, useEffect } from 'react';
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
  alpha
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
  ExpandMore,
  ExpandLess,
  Close,
  MenuOpen,
  ChevronRight,
  Notifications as NotificationsIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import api from '../services/api';
import { LogoCompact } from './Logo';

const PATH_LABELS = {
  '': 'Tableau de bord',
  dashboard: 'Tableau de bord',
  'dashboard/kpis': 'KPIs',
  'dashboard/activity': 'Activité',
  creation: 'Création',
  equipment: 'Équipements',
  'equipment/map': 'Carte',
  'equipment/categories': 'Catégories',
  'equipment/technical': 'Fiches techniques',
  'work-orders': 'Ordres de travail',
  'maintenance-plans': 'Plans de maintenance',
  'maintenance-plans/due': 'Plans en retard',
  planning: 'Planning',
  'planning/assignments': 'Affectations',
  'planning/resources': 'Ressources',
  stock: 'Stock',
  'stock/movements': 'Mouvements',
  'stock/alerts': 'Alertes stock',
  'stock/entries': 'Entrées',
  'stock/exits': 'Sorties',
  'stock/transfers': 'Transferts',
  'stock/inventories': 'Inventaires',
  'stock/reorders': 'Réapprovisionnements',
  suppliers: 'Fournisseurs',
  reports: 'Rapports',
  'reports/exports': 'Exports',
  users: 'Utilisateurs',
  sites: 'Sites',
  settings: 'Paramétrage',
  'settings/roles': 'Rôles',
  contracts: 'Contrats',
  tools: 'Outils',
  checklists: 'Checklists',
  technicians: 'Techniciens',
  'technicians/competencies': 'Compétences',
  'technicians/type-competencies': 'Règles d\'affectation'
};

// Structure du menu hiérarchique comme Sage X3
const menuStructure = [
  {
    id: 'dashboard',
    label: 'Tableau de bord',
    icon: <DashboardIcon />,
    path: '/',
    sections: [
      {
        title: 'Tableau de bord',
        items: [
          { label: 'Vue d\'ensemble', path: '/' },
          { label: 'KPIs', path: '/dashboard/kpis' },
          { label: 'Activité récente', path: '/dashboard/activity' }
        ]
      }
    ]
  },
  {
    id: 'creation',
    label: 'Création',
    icon: <BusinessIcon />,
    path: '/creation',
    sections: [
      {
        title: 'Création',
        items: [
          { label: 'Nouvel élément (site, département, ligne, équipement…)', path: '/creation' }
        ]
      }
    ]
  },
  {
    id: 'equipment',
    label: 'Équipements',
    icon: <BuildIcon />,
    path: '/equipment',
    sections: [
      {
        title: 'Équipements',
        items: [
          { label: 'Liste des équipements', path: '/equipment' },
          { label: 'Carte hiérarchie', path: '/equipment/map' },
          { label: 'Catégories', path: '/equipment/categories' },
          { label: 'Fiches techniques', path: '/equipment/technical' }
        ]
      },
      {
        title: 'Gestion',
        items: [
          { label: 'Historique (par équipement)', path: '/equipment' },
          { label: 'Documents (par équipement)', path: '/equipment' },
          { label: 'Garanties (par équipement)', path: '/equipment' }
        ]
      }
    ]
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    icon: <AssignmentIcon />,
    path: '/work-orders',
    sections: [
      {
        title: 'Ordres de travail',
        items: [
          { label: 'Liste des OT', path: '/work-orders' },
          { label: 'Déclarer une panne', path: '/creation' },
          { label: 'OT en cours', path: '/work-orders?status=in_progress' },
          { label: 'OT planifiés', path: '/work-orders?status=pending' }
        ]
      },
      {
        title: 'Maintenance préventive',
        items: [
          { label: 'Plans de maintenance', path: '/maintenance-plans' },
          { label: 'Checklists', path: '/checklists' },
          { label: 'Échéances', path: '/maintenance-plans/due' }
        ]
      },
      {
        title: 'Planning',
        items: [
          { label: 'Calendrier', path: '/planning' },
          { label: 'Affectations', path: '/planning/assignments' },
          { label: 'Ressources', path: '/planning/resources' }
        ]
      }
    ]
  },
  {
    id: 'stock',
    label: 'Stocks',
    icon: <StockIcon />,
    path: '/stock',
    sections: [
      {
        title: 'Stocks',
        items: [
          { label: 'Liste des pièces', path: '/stock' },
          { label: 'Mouvements', path: '/stock/movements' },
          { label: 'Inventaires', path: '/stock/inventories' },
          { label: 'Alertes stock', path: '/stock/alerts' }
        ]
      },
      {
        title: 'Gestion',
        items: [
          { label: 'Entrées', path: '/stock/entries' },
          { label: 'Sorties', path: '/stock/exits' },
          { label: 'Transferts', path: '/stock/transfers' },
          { label: 'Réapprovisionnements', path: '/stock/reorders' }
        ]
      }
    ]
  },
  {
    id: 'suppliers',
    label: 'Fournisseurs',
    icon: <SupplierIcon />,
    path: '/suppliers',
    sections: [
      {
        title: 'Fournisseurs',
        items: [
          { label: 'Liste des fournisseurs', path: '/suppliers' },
          { label: 'Contrats', path: '/contracts' },
          { label: 'Commandes', path: '/suppliers/orders' }
        ]
      }
    ]
  },
  {
    id: 'tools',
    label: 'Outils',
    icon: <ToolsIcon />,
    path: '/tools',
    sections: [
      {
        title: 'Outils et matériels',
        items: [
          { label: 'Liste des outils', path: '/tools' },
          { label: 'Assignations', path: '/tools/assignments' },
          { label: 'Calibrations', path: '/tools/calibrations' }
        ]
      }
    ]
  },
  {
    id: 'reports',
    label: 'Rapports',
    icon: <ReportsIcon />,
    path: '/reports',
    sections: [
      {
        title: 'Rapports',
        items: [
          { label: 'Coûts par équipement', path: '/reports' },
          { label: 'Disponibilité', path: '/reports?tab=availability' },
          { label: 'Exports', path: '/reports/exports' }
        ]
      }
    ]
  },
  {
    id: 'sites',
    label: 'Sites',
    icon: <BusinessIcon />,
    path: '/sites',
    sections: [
      {
        title: 'Sites',
        items: [
          { label: 'Liste des sites', path: '/sites' },
          { label: 'Lignes de production', path: '/sites/lines' }
        ]
      }
    ]
  },
  {
    id: 'technicians',
    label: 'Techniciens',
    icon: <PeopleIcon />,
    path: '/technicians',
    sections: [
      {
        title: 'Techniciens',
        items: [
          { label: 'Liste des techniciens', path: '/technicians' },
          { label: 'Compétences', path: '/technicians/competencies' },
          { label: 'Règles d\'affectation', path: '/technicians/type-competencies' }
        ]
      }
    ]
  },
  {
    id: 'settings',
    label: 'Paramétrage',
    icon: <SettingsIcon />,
    path: '/settings',
    sections: [
      {
        title: 'Paramétrage',
        items: [
          { label: 'Configuration', path: '/settings' },
          { label: 'Alertes email / SMS', path: '/settings?tab=alertes' },
          { label: 'Utilisateurs', path: '/users' },
          { label: 'Rôles et permissions', path: '/settings/roles' }
        ]
      }
    ]
  }
];

export default function Layout() {
  const [selectedMenuId, setSelectedMenuId] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [menuSearch, setMenuSearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [alertAnchorEl, setAlertAnchorEl] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, logout } = useAuth();

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
  const isDark = theme.palette.mode === 'dark';

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
    menu.label.toLowerCase().includes(menuSearch.toLowerCase())
  );

  // Filtrer les items dans les sections selon la recherche
  const filterItems = (items) => {
    if (!menuSearch) return items;
    return items.filter(item =>
      item.label.toLowerCase().includes(menuSearch.toLowerCase())
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Header global sombre comme Sage X3 */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: '#2C2C2C',
          color: 'white',
          minHeight: 64
        }}
      >
        <Toolbar sx={{ gap: 2, minHeight: '64px !important' }}>
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
              pr: 1.5,
              py: 0.5,
              borderRadius: 1,
              bgcolor: 'rgba(255,255,255,0.08)',
              '&:hover': { opacity: 0.95, bgcolor: 'rgba(255,255,255,0.12)' }
            }}
          >
            <LogoCompact variant="light" size={40} />
          </Box>

          {/* Recherche globale */}
          <Box sx={{ flex: 1, maxWidth: 600 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Rechercher dans le menu Navigation"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: 'rgba(255,255,255,0.7)' }} />
                  </InputAdornment>
                ),
                sx: {
                  bgcolor: 'rgba(255,255,255,0.1)',
                  borderRadius: 1,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.2)'
                  },
                  '& input': {
                    color: 'white',
                    '&::placeholder': {
                      color: 'rgba(255,255,255,0.5)',
                      opacity: 1
                    }
                  }
                }
              }}
            />
          </Box>

          {/* Infos utilisateur et icônes */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              size="small"
              sx={{ color: 'white' }}
              onClick={openAlertsMenu}
              aria-label="Notifications"
            >
              <Badge badgeContent={unreadCount} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
            <IconButton size="small" sx={{ color: 'white' }}>
              <Help />
            </IconButton>
            <IconButton size="small" sx={{ color: 'white' }}>
              <Star />
            </IconButton>
            <Chip
              label={user?.role || 'Utilisateur'}
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white', height: 28 }}
            />
            <IconButton
              onClick={(e) => setAnchorEl(e.currentTarget)}
              size="small"
              sx={{ color: 'white' }}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: '#2EB23E',
                  fontSize: '0.875rem'
                }}
              >
                {(user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')}
              </Avatar>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

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
          Déconnexion
        </MenuItem>
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
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={markAllRead}>
              Tout marquer lu
            </Button>
          )}
        </Box>
        <Divider />
        {alerts.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">Aucune notification</Typography>
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
                {!alert.is_read && <Chip label="Nouveau" size="small" color="primary" sx={{ ml: 'auto' }} />}
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
                Menu
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
                        primary={menu.label}
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
                placeholder="Rechercher dans le menu Navigation"
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
                  Tout réduire
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
                  Tout développer
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
                        {section.title}
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
                          return (
                            <Box
                              key={itemIndex}
                              onClick={() => {
                                navigate(item.path);
                                setMenuSearch('');
                              }}
                              sx={{
                                p: 1.5,
                                borderRadius: 1.5,
                                cursor: 'pointer',
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
                              <Typography
                                variant="body2"
                                sx={{
                                  color: isActive ? 'primary.main' : 'text.secondary',
                                  fontWeight: isActive ? 600 : 400
                                }}
                              >
                                {item.label}
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
            <Breadcrumbs sx={{ mb: 2 }} aria-label="Fil d'Ariane">
              <Link component={RouterLink} to="/" underline="hover" color="inherit" sx={{ fontSize: '0.875rem' }}>
                Accueil
              </Link>
              {location.pathname.split('/').filter(Boolean).map((segment, i, arr) => {
                const path = arr.slice(0, i + 1).join('/');
                const label = PATH_LABELS[path] || segment;
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
            <Outlet />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
