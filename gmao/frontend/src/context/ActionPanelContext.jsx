import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  useTheme,
  alpha,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import { Close, PushPin, PushPinOutlined, Add, Edit, Delete, Print, Download, Visibility, FileCopy, Settings, Refresh, CalendarMonth, People, Schedule, MenuBook, Business, Assignment } from '@mui/icons-material';
import api from '../services/api';
import { getApiErrorMessage } from '../services/api';
import { useSnackbar } from './SnackbarContext';
import { getDefaultPageContext as getRouteContext, getPageTitle } from './actionPanelRoutes';

export { getDefaultPageContext } from './actionPanelRoutes';

const STORAGE_KEY = 'gmao-action-bar-pinned';
const PANEL_WIDTH = 280;
const COLLAPSED_WIDTH = 48;
const HEADER_HEIGHT = 72;

const ENTITY_LABELS = {
  equipment: 'Équipement',
  'work-orders': 'Ordre de travail',
  'maintenance-plans': 'Plan de maintenance',
  'maintenance-projects': 'Projet de maintenance',
  stock: 'Pièce',
  suppliers: 'Fournisseur',
  contracts: 'Contrat',
  tools: 'Outil',
  checklists: 'Checklist',
  sites: 'Site',
  users: 'Utilisateur',
  roles: 'Rôle',
  warranties: 'Garantie',
  technicians: 'Technicien',
  budgets: 'Budget',
  'failure-codes': 'Code défaut'
};

const APP_BASE = '/app';

/** Page de création dédiée par type d'entité. */
function getCreationPath(entityType) {
  switch (entityType) {
    case 'work-orders': return `${APP_BASE}/work-orders/new`;
    case 'maintenance-plans': return `${APP_BASE}/maintenance/creation/plan`;
    case 'maintenance-projects': return `${APP_BASE}/maintenance-projects/new`;
    case 'checklists': return `${APP_BASE}/maintenance/creation/checklist`;
    case 'stock': return `${APP_BASE}/stock/creation/piece`;
    case 'suppliers': return `${APP_BASE}/suppliers/creation/supplier`;
    case 'contracts': return `${APP_BASE}/suppliers/creation/contract`;
    case 'tools': return `${APP_BASE}/tools/creation/tool`;
    case 'sites': return `${APP_BASE}/equipment/creation/site`;
    case 'equipment': return `${APP_BASE}/equipment/creation/machine`;
    case 'users': return `${APP_BASE}/settings/creation/user`;
    case 'failure-codes': return `${APP_BASE}/settings/creation/failure-code`;
    case 'technicians': return `${APP_BASE}/technicians`;
    case 'budgets': return `${APP_BASE}/budgets`;
    default: return `${APP_BASE}/equipment/creation/machine`;
  }
}

/** Chemins réels par type d'entité (certains sont sous settings/ ou ont une structure spécifique). */
function getPathsForEntity(entityType, ent) {
  if (ent?.id == null) return { detailPath: null, editPath: null, detailNavigate: null };
  switch (entityType) {
    case 'roles':
      return {
        detailPath: `${APP_BASE}/settings/roles`,
        editPath: `${APP_BASE}/settings/roles`,
        detailNavigate: (nav) => nav(`${APP_BASE}/settings/roles`, { state: { selectedRoleId: ent.id } }),
      };
    case 'users':
      return { detailPath: `${APP_BASE}/users`, editPath: `${APP_BASE}/users`, detailNavigate: (nav) => nav(`${APP_BASE}/users`) };
    case 'warranties':
      return { detailPath: null, editPath: null, detailNavigate: null };
    case 'stock':
      return {
        detailPath: `${APP_BASE}/stock/parts/${ent.id}`,
        editPath: `${APP_BASE}/stock/parts/${ent.id}`,
        detailNavigate: (nav) => nav(`${APP_BASE}/stock/parts/${ent.id}`),
      };
    case 'maintenance-projects':
      return {
        detailPath: `${APP_BASE}/maintenance-projects/${ent.id}`,
        editPath: `${APP_BASE}/maintenance-projects/${ent.id}/edit`,
        detailNavigate: (nav) => nav(`${APP_BASE}/maintenance-projects/${ent.id}`),
      };
    default:
      return {
        detailPath: `${APP_BASE}/${entityType}/${ent.id}`,
        editPath: `${APP_BASE}/${entityType}/${ent.id}`,
        detailNavigate: (nav) => nav(`${APP_BASE}/${entityType}/${ent.id}`),
      };
  }
}

/** Configuration suppression par type d'entité : { apiPath, listPath }. listPath = où rediriger après suppression. */
const DELETE_CONFIG = {
  equipment: { apiPath: '/equipment', listPath: `${APP_BASE}/equipment` },
  'work-orders': { apiPath: '/work-orders', listPath: `${APP_BASE}/work-orders` },
  contracts: { apiPath: '/contracts', listPath: `${APP_BASE}/contracts` },
  tools: { apiPath: '/tools', listPath: `${APP_BASE}/tools` },
  checklists: { apiPath: '/checklists', listPath: `${APP_BASE}/checklists` },
  'maintenance-projects': { apiPath: '/maintenance-projects', listPath: `${APP_BASE}/maintenance-projects` },
};

/** Actions communes pour les pages de type 'page' (sans entité). */
function buildPageActions(pageId, navigate) {
  const to = (path) => () => navigate(path.startsWith('/') ? path : `${APP_BASE}/${path}`);
  const base = [
    { id: 'refresh', label: 'Rafraîchir', icon: <Refresh />, onClick: () => window.location.reload() },
    { divider: true },
    { id: 'print', label: 'Imprimer', icon: <Print />, onClick: () => window.print() },
    { id: 'export', label: 'Exporter', icon: <Download />, onClick: () => {} }
  ];
  switch (pageId) {
    case 'my-work-orders':
      return [{ id: 'add', label: 'Nouvel OT', icon: <Add />, variant: 'contained', onClick: to('work-orders/new') }, { divider: true }, ...base];
    case 'planning':
      return [{ id: 'calendar', label: 'Calendrier', icon: <CalendarMonth />, onClick: to('planning') }, { divider: true }, ...base];
    case 'effectif':
      return [
        { id: 'presence', label: 'Présence', icon: <People />, onClick: to('effectif/presence') },
        { id: 'pointage', label: 'Pointage', icon: <Schedule />, onClick: to('effectif/pointage') },
        { divider: true },
        ...base
      ];
    case 'training':
      return [
        { id: 'catalog', label: 'Catalogue formations', icon: <MenuBook />, onClick: to('training/catalog') },
        { id: 'plans', label: 'Plans de formation', icon: <CalendarMonth />, onClick: to('training/plans') },
        { divider: true },
        ...base
      ];
    case 'subcontracting':
      return [
        { id: 'contractors', label: 'Sous-traitants', icon: <Business />, onClick: to('subcontracting/contractors') },
        { id: 'orders', label: 'Ordres', icon: <Assignment />, onClick: to('subcontracting/orders') },
        { divider: true },
        ...base
      ];
    case 'maintenance-plans-due':
      return [{ id: 'plans', label: 'Plans de maintenance', icon: <CalendarMonth />, onClick: to('maintenance-plans') }, { divider: true }, ...base];
    default:
      return base;
  }
}

/** Construit titre + actions à partir du contexte page (liste / détail / page). */
function buildFromPageContext(pageContext, navigate, { onDeleteRequest } = {}) {
  if (!pageContext) {
    return { title: 'Actions', actions: [{ id: 'print', label: 'Imprimer', icon: <Print />, onClick: () => window.print() }, { id: 'refresh', label: 'Rafraîchir', icon: <Refresh />, onClick: () => window.location.reload() }], entity: null };
  }

  if (pageContext.type === 'page' && pageContext.pageId) {
    const title = getPageTitle(pageContext.pageId);
    const actions = buildPageActions(pageContext.pageId, navigate);
    return { title, actions, entity: null };
  }

  const { type, entityType, entity, selectedEntity } = pageContext;
  if (!entityType) {
    return { title: 'Actions', actions: buildPageActions('dashboard', navigate), entity: null };
  }

  const ent = entity || selectedEntity;
  const label = ENTITY_LABELS[entityType] || entityType;
  const { detailPath, editPath, detailNavigate } = getPathsForEntity(entityType, ent);
  const canDelete = onDeleteRequest && DELETE_CONFIG[entityType] && ent?.id != null;

  const goDetail = detailNavigate ? () => detailNavigate(navigate) : (detailPath ? () => navigate(detailPath) : null);
  const hasDistinctEdit = editPath && editPath !== detailPath;
  const goEdit = hasDistinctEdit ? () => navigate(editPath) : (detailNavigate ? () => detailNavigate(navigate) : (editPath ? () => navigate(editPath) : goDetail));
  const deleteAction = canDelete
    ? { id: 'delete', label: 'Supprimer', icon: <Delete />, variant: 'contained', color: 'error', onClick: () => onDeleteRequest(entityType, ent) }
    : null;

  if (type === 'detail' && ent && (detailPath || detailNavigate)) {
    const actions = [
      { id: 'view', label: 'Voir les détails', icon: <Visibility />, variant: 'contained', onClick: goDetail },
      { id: 'edit', label: 'Modifier', icon: <Edit />, variant: 'outlined', onClick: goEdit },
      { id: 'duplicate', label: 'Dupliquer', icon: <FileCopy />, variant: 'outlined', onClick: () => {} },
      { divider: true },
      { id: 'print', label: 'Imprimer', icon: <Print />, onClick: () => window.print() },
      { id: 'export', label: 'Exporter', icon: <Download />, onClick: () => {} },
      ...(deleteAction ? [{ divider: true }, deleteAction] : [])
    ];
    return { title: ent.name || ent.code || label, actions, entity: ent };
  }

  if (type === 'list' && ent && (detailPath || detailNavigate)) {
    const actions = [
      { id: 'view', label: 'Voir les détails', icon: <Visibility />, variant: 'contained', onClick: goDetail },
      { id: 'edit', label: 'Modifier', icon: <Edit />, variant: 'outlined', onClick: goEdit },
      { divider: true },
      { id: 'print', label: 'Imprimer', icon: <Print />, onClick: () => window.print() },
      { id: 'export', label: 'Exporter', icon: <Download />, onClick: () => {} },
      ...(deleteAction ? [{ divider: true }, deleteAction] : [])
    ];
    return { title: ent.name || ent.code || label, actions, entity: ent };
  }

  const actions = [
    { id: 'add', label: `Créer un ${label}`, icon: <Add />, variant: 'contained', onClick: () => navigate(getCreationPath(entityType)) },
    { id: 'import', label: 'Importer', icon: <Download />, variant: 'outlined', onClick: () => {} },
    { divider: true },
    { id: 'print', label: 'Imprimer la liste', icon: <Print />, onClick: () => window.print() },
    { id: 'export', label: 'Exporter la liste', icon: <Download />, onClick: () => {} },
    { id: 'settings', label: 'Paramètres', icon: <Settings />, onClick: () => {} }
  ];
  return { title: label, actions, entity: null };
}

const ActionPanelContext = createContext();

export const useActionPanel = () => {
  const context = useContext(ActionPanelContext);
  if (!context) {
    throw new Error('useActionPanel must be used within ActionPanelProvider');
  }
  return context;
};

export const ActionPanelProvider = ({ children }) => {
  const location = useLocation();
  const [pinned, setPinnedState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const [pageContext, setPageContextState] = useState(null);
  const [override, setOverride] = useState(null);

  // À chaque changement de route, réinitialiser le contexte pour que le panneau affiche le défaut de la nouvelle page (puis la page peut appeler setContext).
  useEffect(() => {
    setPageContextState(null);
  }, [location.pathname]);

  const setPinned = useCallback((value) => {
    setPinnedState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
    } catch (_) {}
  }, []);

  const setContext = useCallback((ctx) => {
    setPageContextState(ctx || null);
    setOverride(null);
  }, []);

  const openPanel = useCallback((config) => {
    setOverride({
      title: config.title || 'Actions',
      actions: config.actions || [],
      entity: config.entity ?? null
    });
  }, []);

  const closePanel = useCallback(() => {
    setOverride(null);
  }, []);

  const value = useMemo(() => ({
    setContext,
    setPinned,
    pinned,
    pageContext,
    openPanel,
    closePanel,
    override
  }), [setContext, setPinned, openPanel, closePanel, pinned, pageContext, override]);

  return (
    <ActionPanelContext.Provider value={value}>
      {children}
    </ActionPanelContext.Provider>
  );
};

/** Barre d'actions à droite — panneau large, lisible et professionnel. */
export function ActionBar() {
  const theme = useTheme();
  const { pinned, setPinned, pageContext, setContext, override, closePanel } = useActionPanel();
  const navigate = useNavigate();
  const location = useLocation();
  const snackbar = useSnackbar();
  const [deleteDialog, setDeleteDialog] = useState({ open: false, entityType: null, entity: null });
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDeleteRequest = useCallback((entityType, entity) => {
    setDeleteDialog({ open: true, entityType, entity });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    const { entityType, entity } = deleteDialog;
    const config = entityType && entity && DELETE_CONFIG[entityType];
    if (!config || !entity?.id) {
      setDeleteDialog({ open: false, entityType: null, entity: null });
      return;
    }
    setDeleteLoading(true);
    try {
      await api.delete(`${config.apiPath}/${entity.id}`);
      snackbar.showSuccess('Élément supprimé');
      setDeleteDialog({ open: false, entityType: null, entity: null });
      setContext({ type: 'list', entityType });
      navigate(config.listPath);
    } catch (err) {
      snackbar.showError(getApiErrorMessage(err, 'Erreur lors de la suppression'));
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteDialog, navigate, setContext, snackbar]);

  const handleDeleteDialogClose = useCallback(() => {
    if (!deleteLoading) setDeleteDialog({ open: false, entityType: null, entity: null });
  }, [deleteLoading]);

  const effectiveContext = pageContext ?? getRouteContext(location.pathname);
  const fromContext = buildFromPageContext(effectiveContext, navigate, { onDeleteRequest: handleDeleteRequest });
  const title = override ? override.title : fromContext.title;
  let actions = override ? (override.actions || []) : (fromContext.actions || []);
  if (!Array.isArray(actions) || actions.length === 0) {
    const fallback = buildFromPageContext({ type: 'page', pageId: 'dashboard' }, navigate, { onDeleteRequest: handleDeleteRequest });
    actions = fallback.actions || [];
  }
  const entity = override ? override.entity : fromContext.entity;
  const hasSelection = pageContext && (pageContext.entity || pageContext.selectedEntity);
  const hasOverride = Boolean(override);

  const clearSelection = useCallback(() => {
    if (hasOverride) {
      closePanel();
      return;
    }
    if (pageContext && (pageContext.selectedEntity || pageContext.entity)) {
      setContext({ type: 'list', entityType: pageContext.entityType });
    }
  }, [hasOverride, closePanel, pageContext, setContext]);

  const isDark = theme.palette.mode === 'dark';
  const barBg = isDark ? alpha(theme.palette.background.paper, 0.98) : theme.palette.background.paper;
  const borderColor = theme.palette.divider;
  const hoverPrimary = alpha(theme.palette.primary.main, isDark ? 0.2 : 0.08);
  const textSecondary = theme.palette.text.secondary;

  const deleteDialogEntity = deleteDialog.entity;
  const deleteDialogLabel = deleteDialogEntity ? (deleteDialogEntity.name || deleteDialogEntity.code || 'cet élément') : '';

  // ——— État replié : bandeau étroit avec bouton pour ouvrir ———
  if (!pinned) {
    return (
      <>
      <Paper
        elevation={0}
        component="aside"
        aria-label="Panneau d'actions (réduit)"
        sx={{
          width: COLLAPSED_WIDTH,
          minWidth: COLLAPSED_WIDTH,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderLeft: 1,
          borderColor,
          bgcolor: barBg,
          transition: theme.transitions.create(['width', 'min-width'], { duration: theme.transitions.duration.standard }),
        }}
      >
        <Tooltip title="Ouvrir le panneau d'actions" placement="left">
          <IconButton
            size="medium"
            onClick={() => setPinned(true)}
            aria-label="Ouvrir le panneau d'actions"
            sx={{
              color: textSecondary,
              '&:hover': { color: theme.palette.primary.main, bgcolor: hoverPrimary },
            }}
          >
            <PushPinOutlined />
          </IconButton>
        </Tooltip>
      </Paper>
      <Dialog open={deleteDialog.open} onClose={handleDeleteDialogClose}>
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Supprimer définitivement {deleteDialogLabel} ? Cette action est irréversible.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteDialogClose} disabled={deleteLoading}>Annuler</Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm} disabled={deleteLoading}>
            {deleteLoading ? 'Suppression...' : 'Supprimer'}
          </Button>
        </DialogActions>
      </Dialog>
      </>
    );
  }

  // ——— Panneau déployé : en-tête + liste d'actions avec libellés ———
  return (
    <>
    <Paper
      elevation={0}
      component="aside"
      role="region"
      aria-label={title ? `Actions — ${title}` : 'Panneau d\'actions'}
      sx={{
        width: PANEL_WIDTH,
        minWidth: PANEL_WIDTH,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: 1,
        borderColor,
        bgcolor: barBg,
        minHeight: 0,
        transition: theme.transitions.create(['width', 'min-width'], { duration: theme.transitions.duration.standard }),
      }}
    >
      {/* En-tête fixe — titre dynamique selon la page */}
      <Box
        sx={{
          flexShrink: 0,
          minHeight: HEADER_HEIGHT,
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: theme.palette.divider,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
        aria-live="polite"
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: theme.palette.text.primary, lineHeight: 1.3 }} component="h2">
              {title || 'Actions'}
            </Typography>
            {entity && (entity.code || entity.name) && (
              <Typography variant="caption" sx={{ color: textSecondary, display: 'block', mt: 0.25 }}>
                {entity.code && entity.name ? `${entity.code} — ${entity.name}` : (entity.code || entity.name)}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <Tooltip title="Réduire le panneau" placement="left">
              <IconButton size="small" onClick={() => setPinned(false)} aria-label="Réduire le panneau" sx={{ color: textSecondary, '&:hover': { color: theme.palette.primary.main, bgcolor: hoverPrimary } }}>
                <PushPin sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            {(hasSelection || hasOverride) && (
              <Tooltip title="Fermer" placement="left">
                <IconButton size="small" onClick={clearSelection} aria-label="Fermer la sélection" sx={{ color: textSecondary, '&:hover': { color: theme.palette.error.main, bgcolor: alpha(theme.palette.error.main, 0.08) } }}>
                  <Close sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Box>

      {/* Liste d'actions scrollable */}
      <List
        dense
        disablePadding
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          py: 1,
          '& .MuiListItemButton-root': { borderRadius: 1, mx: 1, mb: 0.25 },
        }}
      >
        {actions.map((action, index) => {
          if (action.divider) {
            return <Divider key={`div-${index}`} sx={{ my: 1, mx: 2 }} component="li" />;
          }
          const handleClick = () => {
            if (action.onClick) action.onClick(entity);
          };
          const isPrimary = action.variant === 'contained' || action.id === 'add' || action.id === 'view';
          const isDanger = action.id === 'delete' || action.color === 'error';
          const iconEl = React.isValidElement(action.icon) ? React.cloneElement(action.icon, { fontSize: 'small' }) : action.icon;
          return (
            <ListItemButton
              key={action.id || index}
              onClick={handleClick}
              disabled={action.disabled}
              aria-label={action.label}
              sx={{
                ...(isPrimary && !isDanger && {
                  color: theme.palette.primary.main,
                  '&:hover': { bgcolor: hoverPrimary },
                }),
                ...(isDanger && {
                  color: theme.palette.error.main,
                  '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.08) },
                }),
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>{iconEl}</ListItemIcon>
              <ListItemText primary={action.label} primaryTypographyProps={{ variant: 'body2' }} />
            </ListItemButton>
          );
        })}
      </List>
    </Paper>
    <Dialog open={deleteDialog.open} onClose={handleDeleteDialogClose}>
      <DialogTitle>Confirmer la suppression</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Supprimer définitivement {deleteDialogLabel} ? Cette action est irréversible.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDeleteDialogClose} disabled={deleteLoading}>Annuler</Button>
        <Button color="error" variant="contained" onClick={handleDeleteConfirm} disabled={deleteLoading}>
          {deleteLoading ? 'Suppression...' : 'Supprimer'}
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}
