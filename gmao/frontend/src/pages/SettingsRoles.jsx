import React, { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Button,
  Checkbox,
  Grid,
  Paper,
  Alert,
  Tooltip,
  IconButton,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  Divider,
  alpha
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import SaveIcon from '@mui/icons-material/Save';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SearchIcon from '@mui/icons-material/Search';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import api from '../services/api';
import { useActionPanel } from '../context/ActionPanelContext';
import { useAuth } from '../context/AuthContext';
import { useSnackbar } from '../context/SnackbarContext';

const ACTIONS = ['view', 'create', 'update', 'delete'];
const ACTION_LABELS = { view: 'Voir', create: 'Créer', update: 'Modifier', delete: 'Supprimer' };

const RESOURCE_LABELS = {
  dashboard: 'Tableau de bord',
  equipment: 'Équipements',
  work_orders: 'Ordres de travail',
  maintenance_plans: 'Plans de maintenance',
  maintenance_projects: 'Projets de maintenance',
  sites: 'Sites',
  stock: 'Stock',
  suppliers: 'Fournisseurs',
  users: 'Utilisateurs',
  reports: 'Rapports',
  settings: 'Paramétrage',
  documents: 'Documents',
  contracts: 'Contrats',
  alerts: 'Alertes',
  checklists: 'Listes de contrôle',
  tools: 'Outils',
  planning: 'Planning',
  technicians: 'Techniciens',
  competencies: 'Compétences',
  intervention_requests: 'Demandes d’intervention',
  audit: 'Audit',
  procedures: 'Procédures',
  tenants: 'Clients (multi-tenant)',
  exploitation: 'Exploitation',
  part_families: 'Familles de pièces',
  part_categories: 'Catégories de pièces',
  part_sub_families: 'Sous-familles',
  brands: 'Marques',
  budgets: 'Budget',
  external_contractors: 'Sous-traitants',
  subcontract_orders: 'Ordres sous-traitance',
  training_catalog: 'Catalogue formations',
  training_plans: 'Plans de formation',
  satisfaction: 'Satisfaction',
  root_causes: 'Causes racines',
  work_order_templates: 'Modèles d’OT',
  stock_locations: 'Emplacements de stock',
  stock_reservations: 'Réservations',
  time_entries: 'Pointage',
  attendance_overrides: 'Présence (congés, etc.)',
  presence: 'Présence',
  scheduled_reports: 'Rapports planifiés',
  failure_codes: 'Codes défaut',
  equipment_models: 'Modèles d’équipements',
  notifications: 'Notifications',
  stock_by_site: 'Stock par site',
  required_document_types: 'Types de documents requis'
};

function groupPermissionsByResource(permissions) {
  const byResource = new Map();
  for (const p of permissions || []) {
    if (!byResource.has(p.resource)) {
      byResource.set(p.resource, []);
    }
    byResource.get(p.resource).push(p);
  }
  return byResource;
}

export default function SettingsRoles() {
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [rolePermissionCodes, setRolePermissionCodes] = useState([]);
  const [loadingRolePerms, setLoadingRolePerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [expandedResources, setExpandedResources] = useState(true);
  const [permissionFilter, setPermissionFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const { setContext } = useActionPanel();
  const location = useLocation();
  const { can } = useAuth();
  const snackbar = useSnackbar();
  const canEdit = can('settings', 'update');

  const selectedCodes = useMemo(() => new Set(rolePermissionCodes), [rolePermissionCodes]);

  const loadRoles = async () => {
    try {
      const res = await api.get('/permissions/roles').catch(() => api.get('/settings/roles'));
      setRoles(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      setRoles([]);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [rolesRes, permsRes] = await Promise.all([
          api.get('/permissions/roles').catch(() => api.get('/settings/roles')),
          api.get('/permissions').catch(() => ({ data: [] }))
        ]);
        if (!cancelled) {
          setRoles(Array.isArray(rolesRes?.data) ? rolesRes.data : []);
          setAllPermissions(permsRes?.data || []);
        }
      } catch (e) {
        if (!cancelled) console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setContext({ type: 'list', entityType: 'roles' });
    return () => setContext(null);
  }, [setContext]);

  useEffect(() => {
    const fromState = location.state?.selectedRoleId;
    if (fromState != null && roles.some((r) => r.id === fromState)) {
      setSelectedId(fromState);
    }
  }, [location.state?.selectedRoleId, roles]);

  useEffect(() => {
    if (!selectedId) {
      setRolePermissionCodes([]);
      setDirty(false);
      return;
    }
    let cancelled = false;
    setLoadingRolePerms(true);
    api.get(`/permissions/roles/${selectedId}/permissions`)
      .then((res) => {
        if (!cancelled) {
          setRolePermissionCodes(Array.isArray(res.data) ? res.data : []);
          setDirty(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRolePermissionCodes([]);
          snackbar.showError(err?.response?.data?.error || 'Impossible de charger les permissions du rôle');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRolePerms(false);
      });
    return () => { cancelled = true; };
  }, [selectedId]);

  useEffect(() => {
    const role = roles.find((r) => r.id === selectedId);
    setContext(role ? { type: 'list', entityType: 'roles', selectedEntity: role } : { type: 'list', entityType: 'roles' });
  }, [selectedId, roles, setContext]);

  const toggleCode = (code) => {
    if (!canEdit) return;
    setRolePermissionCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return [...next];
    });
    setDirty(true);
  };

  const toggleResource = (resource, checked) => {
    if (!canEdit) return;
    const perms = allPermissions.filter((p) => p.resource === resource);
    const codes = perms.map((p) => p.code);
    setRolePermissionCodes((prev) => {
      const next = new Set(prev);
      codes.forEach((c) => (checked ? next.add(c) : next.delete(c)));
      return [...next];
    });
    setDirty(true);
  };

  const selectAll = () => {
    if (!canEdit) return;
    setRolePermissionCodes(allPermissions.map((p) => p.code));
    setDirty(true);
  };

  const selectNone = () => {
    if (!canEdit) return;
    setRolePermissionCodes([]);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!selectedId || !canEdit) return;
    setSaving(true);
    try {
      await api.put(`/permissions/roles/${selectedId}/permissions`, {
        permissions: rolePermissionCodes
      });
      setDirty(false);
      snackbar.showSuccess('Permissions enregistrées.');
    } catch (err) {
      snackbar.showError(err?.response?.data?.error || 'Erreur lors de l’enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenNewRole = () => {
    setNewRoleName('');
    setNewRoleDescription('');
    setDialogOpen(true);
  };

  const handleCloseNewRole = () => {
    if (!creating) setDialogOpen(false);
  };

  const handleCreateRole = async () => {
    const name = (newRoleName || '').trim().toLowerCase();
    if (!name) {
      snackbar.showError('Le nom du rôle est requis.');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post('/permissions/roles', {
        name,
        description: (newRoleDescription || '').trim() || undefined
      });
      const created = res.data;
      await loadRoles();
      setDialogOpen(false);
      setNewRoleName('');
      setNewRoleDescription('');
      setSelectedId(created?.id ?? null);
      snackbar.showSuccess('Rôle créé. Affectez-lui des permissions ci-contre.');
    } catch (err) {
      snackbar.showError(err?.response?.data?.error || 'Impossible de créer le rôle');
    } finally {
      setCreating(false);
    }
  };

  const byResource = useMemo(() => groupPermissionsByResource(allPermissions), [allPermissions]);
  const resourceListAll = useMemo(() => Array.from(byResource.keys()).sort(), [byResource]);
  const resourceList = useMemo(() => {
    if (!permissionFilter.trim()) return resourceListAll;
    const q = permissionFilter.trim().toLowerCase();
    return resourceListAll.filter((r) => {
      const label = (RESOURCE_LABELS[r] || r).toLowerCase();
      return label.includes(q) || r.toLowerCase().includes(q);
    });
  }, [resourceListAll, permissionFilter]);
  const selectedRole = roles.find((r) => r.id === selectedId);

  return (
    <Box sx={{ pb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="text.primary">
            Rôles et permissions
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Créez des rôles et affectez les droits d’accès (voir, créer, modifier, supprimer) par ressource.
          </Typography>
        </Box>
        {canEdit && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenNewRole}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Nouveau rôle
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={selectedId ? 4 : 12}>
          <Card sx={{ borderRadius: 2, boxShadow: 1 }}>
            <CardContent sx={{ '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} color="text.primary">
                  Rôles
                </Typography>
                {canEdit && (
                  <Button size="small" startIcon={<AddIcon />} onClick={handleOpenNewRole}>
                    Ajouter
                  </Button>
                )}
              </Box>
              <Divider sx={{ mb: 2 }} />
              {loading ? (
                <Box display="flex" justifyContent="center" p={4}>
                  <CircularProgress size={32} />
                </Box>
              ) : roles.length === 0 ? (
                <Box textAlign="center" py={4} px={2}>
                  <GroupWorkIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary" variant="body2">
                    Aucun rôle. Créez-en un pour commencer.
                  </Typography>
                  {canEdit && (
                    <Button size="small" startIcon={<AddIcon />} onClick={handleOpenNewRole} sx={{ mt: 2 }}>
                      Créer un rôle
                    </Button>
                  )}
                </Box>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: (t) => alpha(t.palette.primary.main, 0.06) }}>
                      <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Nom</TableCell>
                      <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Description</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, py: 1.5 }}>Utilisateurs</TableCell>
                      {selectedId && (
                        <TableCell align="center" sx={{ fontWeight: 700, py: 1.5 }}>Permissions</TableCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {roles.map((role) => (
                      <TableRow
                        key={role.id}
                        selected={selectedId === role.id}
                        onClick={() => setSelectedId(selectedId === role.id ? null : role.id)}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.04) }
                        }}
                      >
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography fontWeight={selectedId === role.id ? 700 : 500} variant="body2">
                            {role.name}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            {role.description || '–'}
                          </Typography>
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.5 }}>
                          <Chip label={role.userCount ?? 0} size="small" variant="outlined" />
                        </TableCell>
                        {selectedId && (
                          <TableCell align="center" sx={{ py: 1.5 }}>
                            {selectedId === role.id ? (
                              <Chip label={rolePermissionCodes.length} size="small" color="primary" />
                            ) : (
                              <Typography variant="body2" color="text.disabled">–</Typography>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          {!selectedId ? (
            <Paper
              variant="outlined"
              sx={{
                borderRadius: 2,
                minHeight: 320,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: (t) => alpha(t.palette.grey[500], 0.04)
              }}
            >
              <Box textAlign="center" px={4}>
                <GroupWorkIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Sélectionnez un rôle
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Cliquez sur un rôle dans la liste pour afficher et modifier ses permissions.
                </Typography>
              </Box>
            </Paper>
          ) : (
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ p: 2, bgcolor: (t) => alpha(t.palette.primary.main, 0.06), borderBottom: 1, borderColor: 'divider' }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <Typography variant="h6" fontWeight={700}>
                      {selectedRole?.name ?? '–'}
                    </Typography>
                    <Chip label={`${rolePermissionCodes.length} permissions`} size="small" color="primary" variant="outlined" />
                  </Box>
                  <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                    <IconButton
                      size="small"
                      onClick={() => setExpandedResources((e) => !e)}
                      aria-label={expandedResources ? 'Replier' : 'Déplier'}
                    >
                      {expandedResources ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                    {canEdit && (
                      <>
                        <Button size="small" variant="outlined" onClick={selectAll} startIcon={<CheckBoxIcon />}>
                          Tout
                        </Button>
                        <Button size="small" variant="outlined" onClick={selectNone} startIcon={<CheckBoxOutlineBlankIcon />}>
                          Aucune
                        </Button>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleSave}
                          disabled={!dirty || saving}
                          startIcon={<SaveIcon />}
                        >
                          {saving ? 'Enregistrement…' : 'Enregistrer'}
                        </Button>
                      </>
                    )}
                  </Box>
                </Box>
              </Box>

              {!canEdit && (
                <Alert severity="info" sx={{ mx: 2, mt: 2 }}>
                  Vous n’avez pas le droit de modifier les permissions.
                </Alert>
              )}

              {loadingRolePerms ? (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight={240}>
                  <CircularProgress />
                </Box>
              ) : (
                <Box sx={{ p: 2 }}>
                  {resourceList.length > 0 && (
                    <TextField
                      size="small"
                      placeholder="Filtrer les ressources…"
                      value={permissionFilter}
                      onChange={(e) => setPermissionFilter(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" color="action" />
                          </InputAdornment>
                        )
                      }}
                      sx={{ mb: 2, maxWidth: 320 }}
                    />
                  )}
                  <Collapse in={expandedResources}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow sx={{ bgcolor: (t) => alpha(t.palette.grey[500], 0.08) }}>
                          <TableCell sx={{ fontWeight: 700, minWidth: 220 }}>Ressource</TableCell>
                          {ACTIONS.map((action) => (
                            <TableCell key={action} align="center" sx={{ minWidth: 88, fontWeight: 600 }}>
                              {ACTION_LABELS[action]}
                            </TableCell>
                          ))}
                          {canEdit && (
                            <TableCell align="center" sx={{ minWidth: 90, fontWeight: 600 }}>
                              Toute
                            </TableCell>
                          )}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {resourceList.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={ACTIONS.length + 2} align="center" sx={{ py: 4 }}>
                              <Typography color="text.secondary">
                                {permissionFilter ? 'Aucune ressource ne correspond au filtre.' : 'Aucune permission disponible.'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          resourceList.map((resource) => {
                            const perms = byResource.get(resource) || [];
                            const actionMap = Object.fromEntries(perms.map((p) => [p.action, p]));
                            const allChecked = ACTIONS.every((a) => actionMap[a] && selectedCodes.has(actionMap[a].code));
                            const someChecked = ACTIONS.some((a) => actionMap[a] && selectedCodes.has(actionMap[a].code));
                            const label = RESOURCE_LABELS[resource] || resource;
                            return (
                              <TableRow key={resource} hover sx={{ '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.02) } }}>
                                <TableCell sx={{ fontWeight: 500 }}>{label}</TableCell>
                                {ACTIONS.map((action) => {
                                  const p = actionMap[action];
                                  if (!p) return <TableCell key={action} align="center">–</TableCell>;
                                  const checked = selectedCodes.has(p.code);
                                  return (
                                    <TableCell key={action} align="center" padding="checkbox">
                                      <Checkbox
                                        checked={checked}
                                        disabled={!canEdit}
                                        onChange={() => toggleCode(p.code)}
                                        size="small"
                                        color="primary"
                                      />
                                    </TableCell>
                                  );
                                })}
                                {canEdit && perms.length > 0 && (
                                  <TableCell align="center" padding="checkbox">
                                    <Tooltip title={allChecked ? 'Tout décocher' : 'Tout cocher pour cette ressource'}>
                                      <Checkbox
                                        checked={allChecked}
                                        indeterminate={someChecked && !allChecked}
                                        disabled={!canEdit}
                                        onChange={(_, c) => toggleResource(resource, c)}
                                        size="small"
                                        color="primary"
                                      />
                                    </Tooltip>
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </Collapse>
                </Box>
              )}
            </Paper>
          )}
        </Grid>
      </Grid>

      <Dialog open={dialogOpen} onClose={handleCloseNewRole} maxWidth="sm" fullWidth>
        <DialogTitle>Nouveau rôle</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nom du rôle"
            fullWidth
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="ex. superviseur"
            helperText="Sans espaces, en minuscules (ex. superviseur, gestionnaire_stock)"
          />
          <TextField
            margin="dense"
            label="Description (optionnel)"
            fullWidth
            multiline
            rows={2}
            value={newRoleDescription}
            onChange={(e) => setNewRoleDescription(e.target.value)}
            placeholder="Brève description du rôle"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseNewRole} disabled={creating}>
            Annuler
          </Button>
          <Button variant="contained" onClick={handleCreateRole} disabled={creating || !newRoleName.trim()}>
            {creating ? 'Création…' : 'Créer le rôle'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
