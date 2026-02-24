import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
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
import { Close, PushPin, PushPinOutlined, Add, Edit, Delete, Print, Download, Visibility, FileCopy, Settings } from '@mui/icons-material';
import api from '../services/api';
import { getApiErrorMessage } from '../services/api';
import { useSnackbar } from './SnackbarContext';

const STORAGE_KEY = 'gmao-action-bar-pinned';
const PANEL_WIDTH = 280;
const COLLAPSED_WIDTH = 48;
const HEADER_HEIGHT = 72;

const ENTITY_LABELS = {
  equipment: 'Équipement',
  'work-orders': 'Ordre de travail',
  'maintenance-plans': 'Plan de maintenance',
  stock: 'Pièce',
  suppliers: 'Fournisseur',
  contracts: 'Contrat',
  tools: 'Outil',
  checklists: 'Checklist',
  sites: 'Site',
  users: 'Utilisateur',
  roles: 'Rôle',
  warranties: 'Garantie'
};

const APP_BASE = '/app';

/** Page de création dédiée par type d'entité (chaque création dans son module, pas le menu Création). */
function getCreationPath(entityType) {
  switch (entityType) {
    case 'work-orders': return `${APP_BASE}/work-orders/new`;
    case 'maintenance-plans': return `${APP_BASE}/maintenance/creation/plan`;
    case 'checklists': return `${APP_BASE}/maintenance/creation/checklist`;
    case 'stock': return `${APP_BASE}/stock/creation/piece`;
    case 'suppliers': return `${APP_BASE}/suppliers/creation/supplier`;
    case 'contracts': return `${APP_BASE}/suppliers/creation/contract`;
    case 'tools': return `${APP_BASE}/tools/creation/tool`;
    case 'sites': return `${APP_BASE}/equipment/creation/site`;
    case 'equipment': return `${APP_BASE}/equipment/creation/machine`;
    case 'users': return `${APP_BASE}/settings/creation/user`;
    case 'failure-codes': return `${APP_BASE}/settings/creation/failure-code`;
    default: return `${APP_BASE}/equipment/creation/machine`;
  }
}

/** Chemins réels par type d'entité (certains sont sous settings/, pas à la racine /app). */
function getPathsForEntity(entityType, ent) {
  if (ent?.id == null) return { detailPath: null, editPath: null, detailNavigate: null };
  switch (entityType) {
    case 'roles':
      return {
        detailPath: `${APP_BASE}/settings/roles`,
        editPath: `${APP_BASE}/settings/roles`,
        detailNavigate: (nav) => nav(`${APP_BASE}/settings/roles`, { state: { selectedRoleId: ent.id } }),
      };
    case 'warranties':
      return { detailPath: null, editPath: null, detailNavigate: null };
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

/** Construit titre + actions à partir du contexte page (liste / détail / entité sélectionnée). */
function buildFromPageContext(pageContext, navigate, { onDeleteRequest } = {}) {
  if (!pageContext || !pageContext.entityType) {
    return { title: 'Actions', actions: [], entity: null };
  }
  const { type, entityType, entity, selectedEntity } = pageContext;
  const ent = entity || selectedEntity;
  const label = ENTITY_LABELS[entityType] || entityType;
  const hasEditRoute = entityType === 'maintenance-projects';
  const { detailPath, editPath, detailNavigate } = getPathsForEntity(entityType, ent);
  const canDelete = onDeleteRequest && DELETE_CONFIG[entityType] && ent?.id != null;

  const goDetail = detailNavigate ? () => detailNavigate(navigate) : (detailPath ? () => navigate(detailPath) : null);
  const hasDistinctEdit = editPath && editPath !== detailPath;
  const goEdit = hasDistinctEdit ? () => navigate(editPath) : (detailNavigate ? () => detailNavigate(navigate) : (editPath ? () => navigate(editPath) : goDetail));
  const deleteAction = canDelete
    ? { id: 'delete', label: 'Supprimer', icon: <Delete />, display: 'button', variant: 'contained', color: 'error', onClick: () => onDeleteRequest(entityType, ent) }
    : null;

  if (type === 'detail' && ent && (detailPath || detailNavigate)) {
    const actions = [
      { id: 'view', label: 'Voir les détails', icon: <Visibility />, display: 'button', variant: 'contained', onClick: goDetail },
      { id: 'edit', label: 'Modifier', icon: <Edit />, display: 'button', variant: 'outlined', onClick: goEdit },
      { id: 'duplicate', label: 'Dupliquer', icon: <FileCopy />, display: 'button', variant: 'outlined', onClick: () => {} },
      { divider: true },
      { id: 'print', label: 'Imprimer', icon: <Print />, display: 'standalone', onClick: () => window.print() },
      { id: 'export', label: 'Exporter', icon: <Download />, display: 'standalone', onClick: () => {} },
      ...(deleteAction ? [{ divider: true }, deleteAction] : [])
    ];
    return { title: ent.name || ent.code || label, actions, entity: ent };
  }

  if (type === 'list' && ent && (detailPath || detailNavigate)) {
    const actions = [
      { id: 'view', label: 'Voir les détails', icon: <Visibility />, display: 'button', variant: 'contained', onClick: goDetail },
      { id: 'edit', label: 'Modifier', icon: <Edit />, display: 'button', variant: 'outlined', onClick: goEdit },
      { divider: true },
      { id: 'print', label: 'Imprimer', icon: <Print />, display: 'standalone', onClick: () => window.print() },
      { id: 'export', label: 'Exporter', icon: <Download />, display: 'standalone', onClick: () => {} },
      ...(deleteAction ? [{ divider: true }, deleteAction] : [])
    ];
    return { title: ent.name || ent.code || label, actions, entity: ent };
  }

  const actions = [
    { id: 'add', label: `Créer un ${label}`, icon: <Add />, display: 'button', variant: 'contained', onClick: () => navigate(getCreationPath(entityType)) },
    { id: 'import', label: 'Importer', icon: <Download />, display: 'button', variant: 'outlined', onClick: () => {} },
    { divider: true },
    { id: 'print', label: 'Imprimer la liste', icon: <Print />, display: 'standalone', onClick: () => window.print() },
    { id: 'export', label: 'Exporter la liste', icon: <Download />, display: 'standalone', onClick: () => {} },
    { id: 'settings', label: 'Paramètres', icon: <Settings />, display: 'standalone', onClick: () => {} }
  ];
  return { title: label, actions, entity: null };
}

/** Contexte par défaut selon le pathname. Ne retourne jamais null pour que la barre affiche toujours des actions. */
export function getDefaultPageContext(pathname) {
  let segs = pathname.split('/').filter(Boolean);
  if (segs[0] === 'app') segs = segs.slice(1);
  if (segs.length === 0) return { type: 'list', entityType: 'equipment' };
  if (segs[0] === 'settings' && segs[1] === 'roles') return { type: 'list', entityType: 'roles' };
  const entityType = segs[0];
  if (segs.length >= 2 && !['map', 'categories', 'technical', 'new', 'roles', 'lines', 'assignments', 'resources', 'movements', 'inventories', 'alerts', 'entries', 'exits', 'transfers', 'reorders', 'orders', 'exports', 'calibrations', 'due', 'activity', 'kpis', 'creation'].includes(segs[1])) {
    return { type: 'detail', entityType, id: segs[1] };
  }
  return { type: 'list', entityType };
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
  const [pinned, setPinnedState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const [pageContext, setPageContextState] = useState(null);
  const [override, setOverride] = useState(null);

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

  const effectiveContext = pageContext ?? getDefaultPageContext(location.pathname);
  const fromContext = buildFromPageContext(effectiveContext, navigate, { onDeleteRequest: handleDeleteRequest });
  const title = override ? override.title : fromContext.title;
  let actions = override ? (override.actions || []) : (fromContext.actions || []);
  if (!Array.isArray(actions) || actions.length === 0) {
    const fallback = buildFromPageContext({ type: 'list', entityType: 'equipment' }, navigate, { onDeleteRequest: handleDeleteRequest });
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
      {/* En-tête fixe */}
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
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: theme.palette.text.primary, lineHeight: 1.3 }}>
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
