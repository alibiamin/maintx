import React, { createContext, useContext, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, IconButton, Tooltip, Typography, useTheme, alpha } from '@mui/material';
import { Close, PushPin, PushPinOutlined, Add, Edit, Delete, Print, Download, Visibility, FileCopy, Settings } from '@mui/icons-material';

const STORAGE_KEY = 'gmao-action-bar-pinned';
const BAR_WIDTH = 64;
const COLLAPSED_WIDTH = 40;
const ICON_SIZE = 36;
const GAP = 6;

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

/** Construit titre + actions à partir du contexte page (liste / détail / entité sélectionnée). */
function buildFromPageContext(pageContext, navigate) {
  if (!pageContext || !pageContext.entityType) {
    return { title: 'Actions', actions: [], entity: null };
  }
  const { type, entityType, entity, selectedEntity } = pageContext;
  const ent = entity || selectedEntity;
  const label = ENTITY_LABELS[entityType] || entityType;

  // Style comme la maquette: button filled (carré noir), button outlined (carré bordure), standalone (icône seule)
  if (type === 'detail' && ent) {
    const actions = [
      { id: 'view', label: 'Voir les détails', icon: <Visibility />, display: 'button', variant: 'contained', onClick: () => navigate(`/${entityType}/${ent.id}`) },
      { id: 'edit', label: 'Modifier', icon: <Edit />, display: 'button', variant: 'outlined', onClick: () => navigate(`/${entityType}/${ent.id}/edit`) },
      { id: 'duplicate', label: 'Dupliquer', icon: <FileCopy />, display: 'button', variant: 'outlined', onClick: () => {} },
      { divider: true },
      { id: 'print', label: 'Imprimer', icon: <Print />, display: 'standalone', onClick: () => window.print() },
      { id: 'export', label: 'Exporter', icon: <Download />, display: 'standalone', onClick: () => {} },
      { divider: true },
      { id: 'delete', label: 'Supprimer', icon: <Delete />, display: 'button', variant: 'contained', onClick: () => { if (window.confirm(`Supprimer ${ent.name || ent.code || 'cet élément'} ?`)) {} } }
    ];
    return { title: ent.name || ent.code || label, actions, entity: ent };
  }

  if (type === 'list' && ent) {
    const actions = [
      { id: 'view', label: 'Voir les détails', icon: <Visibility />, display: 'button', variant: 'contained', onClick: () => navigate(`/${entityType}/${ent.id}`) },
      { id: 'edit', label: 'Modifier', icon: <Edit />, display: 'button', variant: 'outlined', onClick: () => navigate(`/${entityType}/${ent.id}/edit`) },
      { divider: true },
      { id: 'print', label: 'Imprimer', icon: <Print />, display: 'standalone', onClick: () => window.print() },
      { id: 'export', label: 'Exporter', icon: <Download />, display: 'standalone', onClick: () => {} },
      { divider: true },
      { id: 'delete', label: 'Supprimer', icon: <Delete />, display: 'button', variant: 'contained', onClick: () => { if (window.confirm(`Supprimer ${ent.name || ent.code || 'cet élément'} ?`)) {} } }
    ];
    return { title: ent.name || ent.code || label, actions, entity: ent };
  }

  const actions = [
    { id: 'add', label: `Créer un ${label}`, icon: <Add />, display: 'button', variant: 'contained', onClick: () => navigate('/creation') },
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
  const segs = pathname.split('/').filter(Boolean);
  if (segs.length === 0) return { type: 'list', entityType: 'equipment' };
  const entityType = segs[0];
  if (segs.length >= 2 && !['map', 'categories', 'technical', 'new'].includes(segs[1])) {
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

  const setPinned = (value) => {
    setPinnedState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
    } catch (_) {}
  };

  const setContext = (ctx) => {
    setPageContextState(ctx || null);
    setOverride(null);
  };

  const openPanel = (config) => {
    setOverride({
      title: config.title || 'Actions',
      actions: config.actions || [],
      entity: config.entity ?? null
    });
  };

  const closePanel = () => {
    setOverride(null);
  };

  const value = {
    setContext,
    setPinned,
    pinned,
    pageContext,
    openPanel,
    closePanel,
    override
  };

  return (
    <ActionPanelContext.Provider value={value}>
      {children}
    </ActionPanelContext.Provider>
  );
};

/** Barre d'actions à droite — design épuré et professionnel. */
export function ActionBar() {
  const theme = useTheme();
  const { pinned, setPinned, pageContext, setContext, override, closePanel } = useActionPanel();
  const navigate = useNavigate();
  const location = useLocation();

  const effectiveContext = pageContext ?? getDefaultPageContext(location.pathname);
  const fromContext = buildFromPageContext(effectiveContext, navigate);
  const title = override ? override.title : fromContext.title;
  let actions = override ? (override.actions || []) : (fromContext.actions || []);
  if (!Array.isArray(actions) || actions.length === 0) {
    const fallback = buildFromPageContext({ type: 'list', entityType: 'equipment' }, navigate);
    actions = fallback.actions || [];
  }
  const entity = override ? override.entity : fromContext.entity;
  const hasSelection = pageContext && (pageContext.entity || pageContext.selectedEntity);
  const hasOverride = Boolean(override);

  const clearSelection = () => {
    if (hasOverride) {
      closePanel();
      return;
    }
    if (pageContext && (pageContext.selectedEntity || pageContext.entity)) {
      setContext({ type: 'list', entityType: pageContext.entityType });
    }
  };

  const isDark = theme.palette.mode === 'dark';
  const barBg = isDark ? alpha(theme.palette.background.paper, 0.98) : theme.palette.background.paper;
  const borderColor = theme.palette.divider;
  const hoverBg = alpha(theme.palette.primary.main, isDark ? 0.2 : 0.08);
  const iconSecondary = theme.palette.text.secondary;
  const dividerBg = theme.palette.divider;

  // État replié : une seule icône épingle
  if (!pinned) {
    return (
      <Box
        sx={{
          width: COLLAPSED_WIDTH,
          minWidth: COLLAPSED_WIDTH,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 2,
          borderLeft: 1,
          borderColor,
          bgcolor: barBg,
        }}
      >
        <Tooltip title="Afficher le panneau d'actions" placement="left">
          <IconButton
            size="small"
            onClick={() => setPinned(true)}
            sx={{
              width: ICON_SIZE,
              height: ICON_SIZE,
              color: iconSecondary,
              '&:hover': { color: theme.palette.primary.main, bgcolor: hoverBg },
            }}
          >
            <PushPinOutlined sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  // Barre déployée : en-tête + actions
  return (
    <Box
      role="toolbar"
      aria-label={title ? `Actions - ${title}` : 'Panneau d\'actions'}
      sx={{
        width: BAR_WIDTH,
        minWidth: BAR_WIDTH,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: 1,
        borderColor,
        bgcolor: barBg,
        overflowY: 'auto',
        minHeight: 0,
      }}
    >
      {/* En-tête : titre + contrôles */}
      <Box
        sx={{
          flexShrink: 0,
          px: 1,
          py: 1.5,
          borderBottom: 1,
          borderColor: dividerBg,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            color: iconSecondary,
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
            lineHeight: 1.2,
          }}
        >
          {title || 'Actions'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="Réduire le panneau" placement="left">
            <IconButton
              size="small"
              onClick={() => setPinned(false)}
              sx={{
                width: ICON_SIZE,
                height: ICON_SIZE,
                color: iconSecondary,
                '&:hover': { color: theme.palette.primary.main, bgcolor: hoverBg },
              }}
            >
              <PushPin sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          {(hasSelection || hasOverride) && (
            <Tooltip title="Fermer / Annuler" placement="left">
              <IconButton
                size="small"
                onClick={clearSelection}
                sx={{
                  width: ICON_SIZE,
                  height: ICON_SIZE,
                  color: iconSecondary,
                  '&:hover': { color: theme.palette.error.main, bgcolor: alpha(theme.palette.error.main, 0.08) },
                }}
              >
                <Close sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Liste d'actions */}
      <Box
        sx={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 1.5,
          px: 1,
          gap: 0.5,
        }}
      >
        {actions.map((action, index) => {
          if (action.divider) {
            return (
              <Box
                key={`div-${index}`}
                sx={{
                  width: '80%',
                  height: 1,
                  bgcolor: dividerBg,
                  my: 0.5,
                  opacity: 0.6,
                }}
              />
            );
          }
          const handleClick = () => {
            if (action.onClick) action.onClick(entity);
          };
          const isPrimary = action.variant === 'contained' || action.id === 'add' || action.id === 'view';
          const isDanger = action.id === 'delete' || action.color === 'error';
          return (
            <Tooltip key={action.id || index} title={action.label} placement="left" arrow>
              <IconButton
                onClick={handleClick}
                disabled={action.disabled}
                size="small"
                sx={{
                  width: ICON_SIZE,
                  height: ICON_SIZE,
                  minWidth: ICON_SIZE,
                  borderRadius: 1.5,
                  ...(isPrimary && !isDanger
                    ? {
                        bgcolor: alpha(theme.palette.primary.main, isDark ? 0.35 : 0.12),
                        color: theme.palette.primary.main,
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, isDark ? 0.5 : 0.2),
                          color: theme.palette.primary.main,
                        },
                      }
                    : isDanger
                      ? {
                          color: theme.palette.error.main,
                          bgcolor: 'transparent',
                          '&:hover': {
                            bgcolor: alpha(theme.palette.error.main, 0.08),
                            color: theme.palette.error.main,
                          },
                        }
                      : {
                          color: iconSecondary,
                          bgcolor: 'transparent',
                          '&:hover': {
                            bgcolor: hoverBg,
                            color: theme.palette.primary.main,
                          },
                        }),
                }}
              >
                {React.isValidElement(action.icon)
                  ? React.cloneElement(action.icon, { fontSize: 'small' })
                  : action.icon}
              </IconButton>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
}
