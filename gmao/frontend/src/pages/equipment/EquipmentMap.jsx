import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  alpha,
  useTheme
} from '@mui/material';
import {
  Add as ZoomInIcon,
  Remove as ZoomOutIcon,
  Fullscreen as ResetZoomIcon,
  ExpandMore,
  ExpandLess,
  Business as SiteIcon,
  Category as DepartementIcon,
  AccountTree as LigneIcon,
  Build as MachineIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as OkIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import api from '../../services/api';
import { useActionPanel } from '../../context/ActionPanelContext';

const STATUS_CONFIG = {
  operational: { color: '#10b981', icon: OkIcon, label: 'Opérationnel' },
  maintenance: { color: '#f59e0b', icon: WarningIcon, label: 'Maintenance' },
  out_of_service: { color: '#ef4444', icon: ErrorIcon, label: 'Hors service' },
  retired: { color: '#64748b', icon: InfoIcon, label: 'Retiré' }
};

const EQUIPMENT_TYPE_LABELS = {
  machine: { label: 'Machine', short: 'M' },
  section: { label: 'Section', short: 'S' },
  composant: { label: 'Composant', short: 'C' },
  sous_composant: { label: 'Sous-composant', short: 'SC' }
};

export default function EquipmentMap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [expandedSites, setExpandedSites] = useState({});
  const [expandedLignes, setExpandedLignes] = useState({});
  const [expandedDepartements, setExpandedDepartements] = useState({});
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { setContext } = useActionPanel();

  useEffect(() => {
    setContext({ type: 'list', entityType: 'equipment' });
    return () => setContext(null);
  }, [setContext]);

  useEffect(() => {
    setError(null);
    api.get('/equipment/hierarchy-map')
      .then(r => setData(r.data))
      .catch((err) => {
        console.error(err);
        setError(err.response?.status === 401 ? 'auth' : 'load');
      })
      .finally(() => setLoading(false));
  }, []);

  // Par défaut, tout ouvert
  useEffect(() => {
    if (data?.sites) {
      const sites = {};
      const lignes = {};
      const depts = {};
      data.sites.forEach(s => {
        sites[s.id] = true;
        s.lignes?.forEach(l => { lignes[l.id] = true; });
        s.departements?.forEach(d => { depts[d.id] = true; });
      });
      setExpandedSites(prev => Object.keys(prev).length ? prev : sites);
      setExpandedLignes(prev => Object.keys(prev).length ? prev : lignes);
      setExpandedDepartements(prev => Object.keys(prev).length ? prev : depts);
    }
  }, [data]);

  const handleZoomIn = () => setZoom(z => Math.min(2, z + 0.25));
  const handleZoomOut = () => setZoom(z => Math.max(0.5, z - 0.25));
  const handleResetZoom = () => setZoom(1);

  const toggleSite = (id) => setExpandedSites(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleLigne = (id) => setExpandedLignes(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleDepartement = (id) => setExpandedDepartements(prev => ({ ...prev, [id]: !prev[id] }));

  const getEquipmentsForLigne = (ligne, equipmentList) => {
    // Ligne peut avoir equipments en propriété ou on filtre par ligneId
    if (ligne.equipments && Array.isArray(ligne.equipments)) return ligne.equipments.filter(e => !e.parentId);
    if (!equipmentList) return [];
    return equipmentList.filter(e => e.ligneId === ligne.id && !e.parentId);
  };

  const getEquipmentsForDepartement = (departement, equipmentList) => {
    if (departement.equipments?.length) return departement.equipments;
    if (!equipmentList?.length) return [];
    const depId = departement.id;
    return equipmentList.filter(
      e => (e.departmentId === depId || e.department_id === depId) &&
        !e.parentId && !e.parent_id &&
        (e.equipmentType === 'machine' || e.equipment_type === 'machine' || !e.equipmentType)
    );
  };

  const getChildrenForEquipment = (equipmentId, equipmentList) => {
    if (!equipmentList) return [];
    return equipmentList.filter(
      e => e.parentId === equipmentId || e.parent_id === equipmentId
    );
  };

  const typeInfo = (eq) => EQUIPMENT_TYPE_LABELS[eq.equipmentType] || EQUIPMENT_TYPE_LABELS.machine;

  // Carte générique pour une ligne du tree (même style partout : icône, libellé, statut, menu)
  const TreeRow = ({
    depth = 0,
    IconComponent,
    iconBgColor = '#10b981',
    primary,
    secondary,
    statusLabel = 'Opérationnel',
    statusColor = '#10b981',
    alertCount = 0,
    isCritical = false,
    onClick,
    expandIcon,
    childNodes,
    workOrdersInProgress = []
  }) => (
    <Box sx={{ mb: 1 }}>
      <Box
        onClick={onClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1.5,
          borderRadius: 2,
          cursor: onClick ? 'pointer' : 'default',
          border: '1px solid',
          borderColor: alertCount > 0 ? (isCritical ? '#ef4444' : '#f59e0b') : 'rgba(148,163,184,0.3)',
          bgcolor: alertCount > 0 ? alpha(isCritical ? '#ef4444' : '#f59e0b', 0.08) : isDark ? alpha('#1e293b', 0.6) : alpha('#fff', 0.9),
          boxShadow: 1,
          transition: 'all 0.2s',
          '&:hover': onClick ? { borderColor: '#2EB23E', boxShadow: 2 } : {}
        }}
      >
        {expandIcon != null && <Box sx={{ width: 24, display: 'flex', justifyContent: 'center' }}>{expandIcon}</Box>}
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            bgcolor: iconBgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <IconComponent sx={{ color: 'white', fontSize: 20 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={700} noWrap>
            {primary}
          </Typography>
          {secondary && (
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {secondary}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip
            size="small"
            icon={<OkIcon sx={{ fontSize: 12 }} />}
            label={statusLabel}
            sx={{ height: 20, fontSize: '0.65rem', bgcolor: statusColor, color: 'white', '& .MuiChip-icon': { color: 'white' } }}
          />
          {alertCount > 0 && (
            <Chip size="small" icon={<WarningIcon sx={{ fontSize: 12 }} />} label={`${alertCount} OT`} color={isCritical ? 'error' : 'warning'} sx={{ height: 20, fontSize: '0.65rem' }} />
          )}
        </Box>
      </Box>
      {workOrdersInProgress && workOrdersInProgress.length > 0 && (
        <Box sx={{ ml: 5, mt: 0.5, pl: 1.5, borderLeft: '2px solid', borderColor: alpha('#f59e0b', 0.5) }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>OT en cours</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {workOrdersInProgress.map((wo) => (
              <Tooltip key={wo.id} title={wo.title || wo.number}>
                <Chip
                  size="small"
                  label={wo.number}
                  onClick={(e) => { e.stopPropagation(); navigate(`/app/work-orders/${wo.id}`); }}
                  sx={{
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    bgcolor: wo.priority === 'critical' ? alpha('#ef4444', 0.15) : alpha('#f59e0b', 0.15),
                    color: wo.priority === 'critical' ? '#dc2626' : '#b45309',
                    '&:hover': { bgcolor: wo.priority === 'critical' ? alpha('#ef4444', 0.25) : alpha('#f59e0b', 0.25) }
                  }}
                />
              </Tooltip>
            ))}
          </Box>
        </Box>
      )}
      {childNodes && childNodes.length > 0 && (
        <Box sx={{ ml: 3, pl: 2, borderLeft: '2px dashed', borderColor: 'divider' }}>
          {childNodes}
        </Box>
      )}
    </Box>
  );

  // Branche équipement récursive (Machine → Section → Composant → Sous-composant)
  const EquipmentTreeBranch = ({ eq, depth }) => {
    const children = getChildrenForEquipment(eq.id, data?.equipments);
    const cfg = STATUS_CONFIG[eq.status] || STATUS_CONFIG.operational;
    const typeLabel = typeInfo(eq).label;
    const workOrdersInProgress = eq.workOrdersInProgress || [];
    return (
      <TreeRow
        depth={depth}
        IconComponent={MachineIcon}
        iconBgColor={cfg.color}
        primary={eq.code + (typeLabel !== 'Machine' ? ` — ${typeLabel}` : '')}
        secondary={eq.name}
        statusLabel={cfg.label}
        statusColor={cfg.color}
        alertCount={(eq.alertPending || 0) + (eq.alertInProgress || 0)}
        isCritical={(eq.alertCritical || 0) > 0}
        onClick={(e) => { e?.stopPropagation?.(); navigate(`/app/equipment/${eq.id}`); }}
        workOrdersInProgress={workOrdersInProgress}
        childNodes={children.length > 0 ? children.map(child => <EquipmentTreeBranch key={child.id} eq={child} depth={depth + 1} />) : null}
      />
    );
  };

  // Branche Département : une ligne + enfants = machines (TreeRow récursif)
  const DeptTreeBranch = ({ dep }) => {
    const isExpanded = expandedDepartements[dep.id] !== false;
    const machines = getEquipmentsForDepartement(dep, data?.equipments);
    const alertCount = machines.reduce((s, e) => s + (e.alertPending || 0) + (e.alertInProgress || 0), 0);
    return (
      <TreeRow
        IconComponent={DepartementIcon}
        iconBgColor="#2EB23E"
        primary={dep.name}
        secondary={dep.code ? `(${dep.code})` : null}
        alertCount={alertCount}
        expandIcon={isExpanded ? <ExpandLess /> : <ExpandMore />}
        onClick={() => toggleDepartement(dep.id)}
        childNodes={isExpanded && machines.length > 0 ? machines.map(eq => <EquipmentTreeBranch key={eq.id} eq={eq} depth={2} />) : null}
      />
    );
  };

  // Branche Ligne : une ligne + enfants = machines
  const LigneTreeBranch = ({ ligne }) => {
    const isExpanded = expandedLignes[ligne.id] !== false;
    const machines = getEquipmentsForLigne(ligne, data?.equipments);
    const alertCount = machines.reduce((s, e) => s + (e.alertPending || 0) + (e.alertInProgress || 0), 0);
    return (
      <TreeRow
        IconComponent={LigneIcon}
        iconBgColor="#2EB23E"
        primary={ligne.name}
        secondary={ligne.code ? `(${ligne.code})` : null}
        alertCount={alertCount}
        expandIcon={isExpanded ? <ExpandLess /> : <ExpandMore />}
        onClick={() => toggleLigne(ligne.id)}
        childNodes={isExpanded && machines.length > 0 ? machines.map(eq => <EquipmentTreeBranch key={eq.id} eq={eq} depth={2} />) : null}
      />
    );
  };

  // Branche Site : une ligne + enfants = départements ou lignes
  const SiteTreeBranch = ({ site }) => {
    const departements = site.departements || [];
    const lignes = site.lignes || [];
    const useDepartements = departements.length > 0;
    const isExpanded = expandedSites[site.id] !== false;
    const totalAlerts = useDepartements
      ? departements.reduce((s, d) => {
          const eqs = getEquipmentsForDepartement(d, data?.equipments);
          return s + eqs.reduce((t, e) => t + (e.alertPending || 0) + (e.alertInProgress || 0), 0);
        }, 0)
      : lignes.reduce((s, l) => {
          const eqs = getEquipmentsForLigne(l, data?.equipments);
          return s + eqs.reduce((t, e) => t + (e.alertPending || 0) + (e.alertInProgress || 0), 0);
        }, 0);
    const childNodes = isExpanded
      ? useDepartements
        ? departements
            .filter((d, i, arr) => arr.findIndex(x => x.id === d.id) === i)
            .map(d => <DeptTreeBranch key={d.id} dep={d} />)
        : lignes
            .filter((l, i, arr) => arr.findIndex(x => x.id === l.id) === i)
            .map(l => <LigneTreeBranch key={l.id} ligne={l} />)
      : null;
    return (
      <TreeRow
        IconComponent={SiteIcon}
        iconBgColor="#2EB23E"
        primary={site.name}
        secondary={[site.code, site.address].filter(Boolean).join(' • ') || null}
        alertCount={totalAlerts}
        expandIcon={isExpanded ? <ExpandLess /> : <ExpandMore />}
        onClick={() => toggleSite(site.id)}
        childNodes={childNodes}
      />
    );
  };

  if (loading) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight={400} gap={2}>
        <CircularProgress />
        <Typography color="text.secondary">Chargement du plan...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Card sx={{ p: 4, textAlign: 'center', maxWidth: 480, mx: 'auto' }}>
        <Typography color="error" gutterBottom>
          {error === 'auth' ? 'Session expirée ou non connecté' : 'Erreur de chargement des données'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {error === 'auth'
            ? 'Connectez-vous pour afficher le plan hiérarchique.'
            : 'Vérifiez que l\'API backend est démarrée et réessayez.'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          {error === 'auth' && (
            <Button variant="contained" onClick={() => navigate('/login')}>
              Se connecter
            </Button>
          )}
          <Button
            variant="outlined"
            onClick={() => {
              setError(null);
              setLoading(true);
              api.get('/equipment/hierarchy-map')
                .then(r => setData(r.data))
                .catch((err) => { setError(err.response?.status === 401 ? 'auth' : 'load'); })
                .finally(() => setLoading(false));
            }}
          >
            Réessayer
          </Button>
        </Box>
      </Card>
    );
  }

  return (
    <Box sx={{ position: 'relative', zIndex: 1 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700} letterSpacing="-0.02em">
            Plan hiérarchique 2D
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Site → Département (ou Ligne) → Machine → Section → Composant → Sous-composant — Cliquez pour développer
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={0.5}>
          <Tooltip title="Réduire">
            <IconButton onClick={handleZoomOut} size="small">
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          <Typography variant="body2" sx={{ minWidth: 48, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </Typography>
          <Tooltip title="Agrandir">
            <IconButton onClick={handleZoomIn} size="small">
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Réinitialiser">
            <IconButton onClick={handleResetZoom} size="small">
              <ResetZoomIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box
        sx={{
          overflow: 'auto',
          width: '100%',
          minHeight: 500,
          maxHeight: 'calc(100vh - 220px)',
          p: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'rgba(148,163,184,0.15)'
        }}
      >
        <Box
          sx={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            width: zoom < 1 ? `${100 / zoom}%` : '100%',
            minWidth: 400,
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}
        >
          {data?.sites?.length === 0 ? (
            <Card sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">Aucun site ou équipement configuré</Typography>
            </Card>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 720 }}>
              {data.sites.map(site => (
                <SiteTreeBranch key={site.id} site={site} />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
