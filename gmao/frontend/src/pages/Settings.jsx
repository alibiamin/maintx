import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
  Tabs,
  Tab,
  Alert,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { Save, Backup, Email, Sms, Add, Edit, Delete, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSnackbar } from '../context/SnackbarContext';
import { useCurrencyRefresh } from '../context/CurrencyContext';

const CODIFICATION_ENTITIES = [
  { key: 'site', label: 'Site' },
  { key: 'departement', label: 'Département' },
  { key: 'ligne', label: 'Ligne' },
  { key: 'machine', label: 'Machine / Équipement' },
  { key: 'piece', label: 'Pièce détachée' },
  { key: 'outil', label: 'Outil' },
  { key: 'fournisseur', label: 'Fournisseur' },
  { key: 'code_defaut', label: 'Code défaut' },
  { key: 'demande_intervention', label: 'Demande d\'intervention' }
];

export default function Settings() {
  const [failureCodes, setFailureCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [codification, setCodification] = useState({});
  const [codificationSave, setCodificationSave] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifPrefs, setNotifPrefs] = useState({ email: '', phone: '', events: [], preferences: {} });
  const [notifPhone, setNotifPhone] = useState('');
  const [notifPreferences, setNotifPreferences] = useState({});
  const [notifSaving, setNotifSaving] = useState(false);
  const [currency, setCurrency] = useState('€');
  const [currencySaving, setCurrencySaving] = useState(false);
  const [auditLog, setAuditLog] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilters, setAuditFilters] = useState({ entityType: '', startDate: '', endDate: '' });
  const [units, setUnits] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitDialog, setUnitDialog] = useState({ open: false, id: null, name: '', symbol: '' });
  const [unitSaving, setUnitSaving] = useState(false);
  const [kpiDefinitions, setKpiDefinitions] = useState([]);
  const [kpiSources, setKpiSources] = useState([]);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiDialog, setKpiDialog] = useState({ open: false, id: null, name: '', source_key: '', color: 'primary', icon: '', is_visible: true });
  const [kpiSaving, setKpiSaving] = useState(false);
  const [indicatorTargets, setIndicatorTargets] = useState([]);
  const [indicatorTargetsLoading, setIndicatorTargetsLoading] = useState(false);
  const [indicatorTargetsSaving, setIndicatorTargetsSaving] = useState(false);
  const { user } = useAuth();
  const canEditCodification = ['administrateur', 'responsable_maintenance'].includes(user?.role);
  const canEditUnits = ['administrateur', 'responsable_maintenance'].includes(user?.role);
  const canEditKpis = ['administrateur', 'responsable_maintenance'].includes(user?.role);
  const canEditTargets = ['administrateur', 'responsable_maintenance'].includes(user?.role);
  const isAdmin = user?.role === 'administrateur';
  const canViewAudit = ['administrateur', 'responsable_maintenance'].includes(user?.role);
  const snackbar = useSnackbar();
  const [searchParams, setSearchParams] = useSearchParams();
  const unitsTabIndex = 3;
  const kpiTabIndex = 4;
  const targetsTabIndex = 5;
  const backupTabIndex = 6; // Sauvegarde (visible seulement si isAdmin)
  const alertesTabIndex = isAdmin ? 7 : 6;
  const auditTabIndex = alertesTabIndex + 1;

  useEffect(() => {
    if (searchParams.get('tab') === 'alertes') setTab(alertesTabIndex);
    if (searchParams.get('tab') === 'audit') setTab(auditTabIndex);
    if (searchParams.get('tab') === 'kpis') setTab(kpiTabIndex);
    if (searchParams.get('tab') === 'targets') setTab(targetsTabIndex);
  }, [searchParams.get('tab'), alertesTabIndex, auditTabIndex, kpiTabIndex, targetsTabIndex]);

  useEffect(() => {
    if (!canViewAudit || tab !== auditTabIndex) return;
    setAuditLoading(true);
    const params = { limit: 200 };
    if (auditFilters.entityType) params.entityType = auditFilters.entityType;
    if (auditFilters.startDate) params.startDate = auditFilters.startDate;
    if (auditFilters.endDate) params.endDate = auditFilters.endDate;
    api.get('/audit', { params })
      .then((r) => setAuditLog(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAuditLog([]))
      .finally(() => setAuditLoading(false));
  }, [canViewAudit, tab, auditTabIndex, auditFilters.entityType, auditFilters.startDate, auditFilters.endDate]);

  const refreshCurrency = useCurrencyRefresh();
  useEffect(() => {
    api.get('/failure-codes').then(r => setFailureCodes(r.data)).catch(() => setFailureCodes([])).finally(() => setLoading(false));
    api.get('/settings/codification').then(r => setCodification(r.data || {})).catch(() => setCodification({}));
    api.get('/settings/currency').then(r => setCurrency(r.data?.value || '€')).catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/notifications/preferences')
      .then((r) => {
        setNotifPrefs(r.data);
        setNotifPhone(r.data.phone || '');
        setNotifPreferences(r.data.preferences || {});
      })
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  }, []);

  useEffect(() => {
    if (tab !== unitsTabIndex) return;
    setUnitsLoading(true);
    api.get('/settings/units')
      .then((r) => setUnits(Array.isArray(r.data) ? r.data : []))
      .catch(() => setUnits([]))
      .finally(() => setUnitsLoading(false));
  }, [tab, unitsTabIndex]);

  const openUnitDialog = (u = null) => {
    setUnitDialog({ open: true, id: u?.id ?? null, name: u?.name ?? '', symbol: u?.symbol ?? '' });
  };
  const closeUnitDialog = () => setUnitDialog({ open: false, id: null, name: '', symbol: '' });
  const handleSaveUnit = () => {
    const { id, name, symbol } = unitDialog;
    if (!name || !name.trim()) { snackbar.showError('Nom requis'); return; }
    setUnitSaving(true);
    const promise = id
      ? api.put(`/settings/units/${id}`, { name: name.trim(), symbol: (symbol || '').trim() })
      : api.post('/settings/units', { name: name.trim(), symbol: (symbol || '').trim() });
    promise
      .then(() => {
        snackbar.showSuccess(id ? 'Unité modifiée' : 'Unité ajoutée');
        closeUnitDialog();
        api.get('/settings/units').then((r) => setUnits(Array.isArray(r.data) ? r.data : [])).catch(() => {});
      })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setUnitSaving(false));
  };
  const handleDeleteUnit = (id) => {
    if (!window.confirm('Supprimer cette unité ? Les pièces qui l\'utilisent empêcheront la suppression.')) return;
    api.delete(`/settings/units/${id}`)
      .then(() => {
        snackbar.showSuccess('Unité supprimée');
        setUnits((prev) => prev.filter((u) => u.id !== id));
      })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'));
  };

  useEffect(() => {
    if (tab !== kpiTabIndex) return;
    setKpiLoading(true);
    Promise.all([
      api.get('/settings/kpi-definitions'),
      api.get('/settings/kpi-definitions/sources')
    ])
      .then(([defRes, srcRes]) => {
        setKpiDefinitions(Array.isArray(defRes.data) ? defRes.data : []);
        setKpiSources(Array.isArray(srcRes.data) ? srcRes.data : []);
      })
      .catch(() => {
        setKpiDefinitions([]);
        setKpiSources([]);
      })
      .finally(() => setKpiLoading(false));
  }, [tab, kpiTabIndex]);

  useEffect(() => {
    if (tab !== targetsTabIndex) return;
    setIndicatorTargetsLoading(true);
    api.get('/settings/indicator-targets')
      .then((r) => setIndicatorTargets(Array.isArray(r.data) ? r.data : []))
      .catch(() => setIndicatorTargets([]))
      .finally(() => setIndicatorTargetsLoading(false));
  }, [tab, targetsTabIndex]);

  const openKpiDialog = (k = null) => {
    setKpiDialog({
      open: true,
      id: k?.id ?? null,
      name: k?.name ?? '',
      source_key: k?.source_key ?? '',
      color: k?.color ?? 'primary',
      icon: k?.icon ?? '',
      is_visible: k?.is_visible !== 0 && k?.is_visible !== false
    });
  };
  const closeKpiDialog = () => setKpiDialog({ open: false, id: null, name: '', source_key: '', color: 'primary', icon: '', is_visible: true });
  const handleSaveKpi = () => {
    const { id, name, source_key, color, icon, is_visible } = kpiDialog;
    if (!name || !name.trim()) { snackbar.showError('Nom requis'); return; }
    if (!source_key || !source_key.trim()) { snackbar.showError('Indicateur (source) requis'); return; }
    setKpiSaving(true);
    const promise = id
      ? api.put(`/settings/kpi-definitions/${id}`, { name: name.trim(), source_key, color, icon: icon || null, is_visible: !!is_visible })
      : api.post('/settings/kpi-definitions', { name: name.trim(), source_key, color, icon: icon || null, is_visible: !!is_visible });
    promise
      .then(() => {
        snackbar.showSuccess(id ? 'Indicateur modifié' : 'Indicateur ajouté');
        closeKpiDialog();
        api.get('/settings/kpi-definitions').then((r) => setKpiDefinitions(Array.isArray(r.data) ? r.data : [])).catch(() => {});
      })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setKpiSaving(false));
  };
  const handleDeleteKpi = (id) => {
    if (!window.confirm('Supprimer cet indicateur de la page KPIs ?')) return;
    api.delete(`/settings/kpi-definitions/${id}`)
      .then(() => {
        snackbar.showSuccess('Indicateur supprimé');
        setKpiDefinitions((prev) => prev.filter((k) => k.id !== id));
      })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'));
  };
  const moveKpi = (index, direction) => {
    if (index + direction < 0 || index + direction >= kpiDefinitions.length) return;
    const next = [...kpiDefinitions];
    const a = next[index];
    const b = next[index + direction];
    const orderA = a.order_index;
    const orderB = b.order_index;
    api.put('/settings/kpi-definitions/reorder', {
      order: [
        { id: a.id, order_index: orderB },
        { id: b.id, order_index: orderA }
      ]
    })
      .then(() => {
        [next[index], next[index + direction]] = [next[index + direction], next[index]];
        setKpiDefinitions(next);
        snackbar.showSuccess('Ordre mis à jour');
      })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'));
  };

  const handleSaveCurrency = () => {
    setCurrencySaving(true);
    api.post('/settings/currency', { value: currency })
      .then(() => {
        refreshCurrency();
        snackbar.showSuccess('Devise enregistrée');
      })
      .catch(() => snackbar.showError('Erreur enregistrement'))
      .finally(() => setCurrencySaving(false));
  };

  const handleCodificationChange = (entity, field, value) => {
    setCodification(prev => ({
      ...prev,
      [entity]: { ...(prev[entity] || {}), [field]: value }
    }));
  };

  const handleSaveCodification = () => {
    setCodificationSave('');
    api.put('/settings/codification', codification)
      .then(() => { setCodificationSave('Codification enregistrée.'); snackbar.showSuccess('Codification enregistrée'); })
      .catch(() => { setCodificationSave('Erreur lors de l\'enregistrement.'); snackbar.showError('Erreur enregistrement'); });
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await api.get('/settings/backup', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `xmaint-backup-${new Date().toISOString().slice(0, 10)}.db`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleNotifPrefChange = (eventType, channel, checked) => {
    setNotifPreferences((prev) => ({
      ...prev,
      [eventType]: { ...(prev[eventType] || {}), [channel]: checked }
    }));
  };

  const handleSaveNotifPrefs = () => {
    setNotifSaving(true);
    api.put('/notifications/preferences', { phone: notifPhone || undefined, preferences: notifPreferences })
      .then((r) => {
        setNotifPrefs(r.data);
        setNotifPhone(r.data.phone || '');
        setNotifPreferences(r.data.preferences || {});
        snackbar.showSuccess('Préférences d\'alertes enregistrées');
      })
      .catch(() => snackbar.showError('Erreur lors de l\'enregistrement des alertes'))
      .finally(() => setNotifSaving(false));
  };

  if (loading && failureCodes.length === 0) return <Box p={4}><CircularProgress /></Box>;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
        Paramétrage
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => {
          setTab(v);
          if (v === alertesTabIndex) setSearchParams({ tab: 'alertes' });
          else if (v === auditTabIndex) setSearchParams({ tab: 'audit' });
          else if (v === kpiTabIndex) setSearchParams({ tab: 'kpis' });
          else if (v === targetsTabIndex) setSearchParams({ tab: 'targets' });
          else setSearchParams({});
        }}
        sx={{ mb: 2 }}
      >
        <Tab label="Général" />
        <Tab label="Codes défaut" />
        <Tab label="Codification" />
        <Tab label="Unités" />
        <Tab label="Indicateurs KPI" />
        <Tab label="Objectifs indicateurs" />
        {isAdmin && <Tab label="Sauvegarde" />}
        <Tab label="Alertes email / SMS" />
        {canViewAudit && <Tab label="Journal d'audit" />}
      </Tabs>

      {tab === 0 && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Devise de l'application
            </Typography>
            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
              <TextField
                label="Symbole ou code devise"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                size="small"
                placeholder="€"
                sx={{ width: 160 }}
              />
              <Button variant="contained" startIcon={<Save />} onClick={handleSaveCurrency} disabled={currencySaving}>
                {currencySaving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              Ex. € (euro), $ (dollar), £ (livre). Utilisé pour tous les montants (coûts, taux horaires, rapports).
            </Typography>
          </CardContent>
        </Card>
      )}

      {tab === 1 && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Codes défaut / Causes de panne
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Référentiel pour l'analyse des pannes (inspiré Coswin, arbre de défaillance)
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Nom</TableCell>
                  <TableCell>Catégorie</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {failureCodes.map((fc) => (
                  <TableRow key={fc.id}>
                    <TableCell>{fc.code}</TableCell>
                    <TableCell>{fc.name}</TableCell>
                    <TableCell>{fc.category || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {failureCodes.length === 0 && (
              <Typography color="text.secondary">Exécutez la migration 002 pour charger les codes par défaut.</Typography>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 2 && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
              Codification des éléments
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Définissez un préfixe et le nombre de chiffres pour les codes. À la création (site, département, ligne…), le code sera généré automatiquement et l&apos;utilisateur saisit uniquement la désignation.
            </Typography>
            {codificationSave && <Alert severity={codificationSave.startsWith('Erreur') ? 'error' : 'success'} sx={{ mb: 2 }} onClose={() => setCodificationSave('')}>{codificationSave}</Alert>}
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Élément</TableCell>
                  <TableCell>Préfixe</TableCell>
                  <TableCell>Longueur (chiffres)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {CODIFICATION_ENTITIES.map(({ key, label }) => (
                  <TableRow key={key}>
                    <TableCell>{label}</TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={codification[key]?.prefix ?? ''}
                        onChange={(e) => handleCodificationChange(key, 'prefix', e.target.value)}
                        placeholder="ex: S"
                        sx={{ width: 120 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        inputProps={{ min: 1, max: 10 }}
                        value={codification[key]?.length ?? ''}
                        onChange={(e) => handleCodificationChange(key, 'length', e.target.value)}
                        placeholder="4"
                        sx={{ width: 80 }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Box sx={{ mt: 2 }}>
              <Button variant="contained" startIcon={<Save />} onClick={handleSaveCodification} disabled={!canEditCodification}>
                Enregistrer la codification
              </Button>
              {!canEditCodification && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Réservé aux administrateurs et responsables.
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {tab === unitsTabIndex && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Unités (stock)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Référentiel des unités utilisées lors de la création de pièces (unité, pièce, mètre, kg, etc.).
            </Typography>
            {unitsLoading ? (
              <Box display="flex" justifyContent="center" p={2}><CircularProgress /></Box>
            ) : (
              <>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nom</TableCell>
                      <TableCell>Symbole</TableCell>
                      {canEditUnits && <TableCell width={120}>Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {units.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>{u.name}</TableCell>
                        <TableCell>{u.symbol || '—'}</TableCell>
                        {canEditUnits && (
                          <TableCell>
                            <IconButton size="small" onClick={() => openUnitDialog(u)} title="Modifier"><Edit fontSize="small" /></IconButton>
                            <IconButton size="small" onClick={() => handleDeleteUnit(u.id)} title="Supprimer" color="error"><Delete fontSize="small" /></IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {canEditUnits && (
                  <Button startIcon={<Add />} variant="outlined" sx={{ mt: 2 }} onClick={() => openUnitDialog()}>
                    Ajouter une unité
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={unitDialog.open} onClose={closeUnitDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{unitDialog.id ? 'Modifier l\'unité' : 'Nouvelle unité'}</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth label="Nom" value={unitDialog.name} onChange={(e) => setUnitDialog((d) => ({ ...d, name: e.target.value }))} sx={{ mt: 1 }} />
          <TextField fullWidth label="Symbole" value={unitDialog.symbol} onChange={(e) => setUnitDialog((d) => ({ ...d, symbol: e.target.value }))} placeholder="ex: pce, m, kg" sx={{ mt: 2 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeUnitDialog}>Annuler</Button>
          <Button variant="contained" onClick={handleSaveUnit} disabled={unitSaving}>{unitSaving ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </DialogActions>
      </Dialog>

      {tab === targetsTabIndex && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Objectifs des indicateurs
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Valeurs cibles utilisées pour le tableau de bord, la page Indicateurs et l&apos;Assistance à la décision. Référence : norme EN 15341 et bonnes pratiques. Direction « min » : la valeur doit être ≥ objectif ; « max » : la valeur doit être ≤ objectif.
            </Typography>
            {indicatorTargetsLoading ? (
              <Box display="flex" justifyContent="center" p={2}><CircularProgress /></Box>
            ) : (
              <>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Indicateur</TableCell>
                      <TableCell>Objectif</TableCell>
                      <TableCell>Direction</TableCell>
                      <TableCell>Unité</TableCell>
                      <TableCell>Référence</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {indicatorTargets.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell>{row.label}</TableCell>
                        <TableCell>
                          {canEditTargets ? (
                            <TextField
                              type="number"
                              size="small"
                              value={row.target_value}
                              onChange={(e) => setIndicatorTargets((prev) => prev.map((r) => r.key === row.key ? { ...r, target_value: parseFloat(e.target.value) || 0 } : r))}
                              inputProps={{ step: 0.1, min: 0 }}
                              sx={{ width: 100 }}
                            />
                          ) : (
                            row.target_value
                          )}
                        </TableCell>
                        <TableCell>{row.direction === 'max' ? 'Max (≤)' : 'Min (≥)'}</TableCell>
                        <TableCell>{row.unit || '—'}</TableCell>
                        <TableCell>{row.ref_label || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {canEditTargets && indicatorTargets.length > 0 && (
                  <Button variant="contained" startIcon={<Save />} sx={{ mt: 2 }} onClick={() => {
                    setIndicatorTargetsSaving(true);
                    api.put('/settings/indicator-targets', indicatorTargets)
                      .then((r) => {
                        setIndicatorTargets(Array.isArray(r.data) ? r.data : []);
                        snackbar.showSuccess('Objectifs enregistrés');
                      })
                      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
                      .finally(() => setIndicatorTargetsSaving(false));
                  }} disabled={indicatorTargetsSaving}>
                    {indicatorTargetsSaving ? 'Enregistrement…' : 'Enregistrer les objectifs'}
                  </Button>
                )}
                {indicatorTargets.length === 0 && !indicatorTargetsLoading && (
                  <Typography color="text.secondary">Aucun objectif. Exécutez les migrations pour créer les valeurs par défaut.</Typography>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === kpiTabIndex && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Indicateurs de performance (KPIs)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choisissez et ordonnez les indicateurs affichés sur la page Indicateurs de performance. Vous pouvez ajouter, modifier, supprimer ou réordonner les cartes.
            </Typography>
            {kpiLoading ? (
              <Box display="flex" justifyContent="center" p={2}><CircularProgress /></Box>
            ) : (
              <>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width={48}>Ordre</TableCell>
                      <TableCell>Nom</TableCell>
                      <TableCell>Source (donnée)</TableCell>
                      <TableCell>Visible</TableCell>
                      {canEditKpis && <TableCell width={160}>Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {kpiDefinitions.map((k, index) => (
                      <TableRow key={k.id}>
                        <TableCell>
                          {canEditKpis && (
                            <Box display="flex" gap={0.5}>
                              <IconButton size="small" disabled={index === 0} onClick={() => moveKpi(index, -1)} title="Monter"><ArrowUpward fontSize="small" /></IconButton>
                              <IconButton size="small" disabled={index === kpiDefinitions.length - 1} onClick={() => moveKpi(index, 1)} title="Descendre"><ArrowDownward fontSize="small" /></IconButton>
                            </Box>
                          )}
                        </TableCell>
                        <TableCell>{k.name}</TableCell>
                        <TableCell>{kpiSources.find((s) => s.key === k.source_key)?.label ?? k.source_key}</TableCell>
                        <TableCell>{k.is_visible ? 'Oui' : 'Non'}</TableCell>
                        {canEditKpis && (
                          <TableCell>
                            <IconButton size="small" onClick={() => openKpiDialog(k)} title="Modifier"><Edit fontSize="small" /></IconButton>
                            <IconButton size="small" onClick={() => handleDeleteKpi(k.id)} title="Supprimer" color="error"><Delete fontSize="small" /></IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {canEditKpis && (
                  <Button startIcon={<Add />} variant="outlined" sx={{ mt: 2 }} onClick={() => openKpiDialog()}>
                    Ajouter un indicateur
                  </Button>
                )}
                {kpiDefinitions.length === 0 && !kpiLoading && (
                  <Typography color="text.secondary" sx={{ mt: 2 }}>Aucun indicateur personnalisé. La page KPIs affichera les indicateurs par défaut. Ajoutez-en pour personnaliser.</Typography>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={kpiDialog.open} onClose={closeKpiDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{kpiDialog.id ? 'Modifier l\'indicateur' : 'Nouvel indicateur KPI'}</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth label="Nom affiché" value={kpiDialog.name} onChange={(e) => setKpiDialog((d) => ({ ...d, name: e.target.value }))} placeholder="ex: Disponibilité" sx={{ mt: 1 }} />
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Source (donnée)</InputLabel>
            <Select value={kpiDialog.source_key} label="Source (donnée)" onChange={(e) => setKpiDialog((d) => ({ ...d, source_key: e.target.value }))}>
              <MenuItem value="">—</MenuItem>
              {kpiSources.map((s) => (
                <MenuItem key={s.key} value={s.key}>{s.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Couleur</InputLabel>
            <Select value={kpiDialog.color} label="Couleur" onChange={(e) => setKpiDialog((d) => ({ ...d, color: e.target.value }))}>
              <MenuItem value="primary">Principal</MenuItem>
              <MenuItem value="success">Succès</MenuItem>
              <MenuItem value="warning">Attention</MenuItem>
              <MenuItem value="error">Erreur</MenuItem>
              <MenuItem value="info">Info</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel control={<Checkbox checked={!!kpiDialog.is_visible} onChange={(e) => setKpiDialog((d) => ({ ...d, is_visible: e.target.checked }))} />} label="Visible sur la page KPIs" sx={{ mt: 2, display: 'block' }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeKpiDialog}>Annuler</Button>
          <Button variant="contained" onClick={handleSaveKpi} disabled={kpiSaving}>{kpiSaving ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </DialogActions>
      </Dialog>

      {isAdmin && tab === backupTabIndex && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Sauvegarde de la base de données
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Téléchargez une copie du fichier SQLite (toutes les données). Réservé aux administrateurs.
            </Typography>
            <Button
              variant="contained"
              startIcon={<Backup />}
              onClick={handleBackup}
              disabled={backupLoading}
            >
              {backupLoading ? 'Téléchargement…' : 'Télécharger une sauvegarde'}
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === alertesTabIndex && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Alertes par email et SMS
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choisissez les événements pour lesquels vous souhaitez recevoir une alerte par email et/ou SMS (nouvelle panne, affectation, clôture OT, plans en retard, alerte stock).
            </Typography>
            {notifLoading ? (
              <CircularProgress size={24} />
            ) : (
              <>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Email (lecture seule)</Typography>
                  <TextField size="small" value={notifPrefs.email || ''} disabled fullWidth sx={{ maxWidth: 400 }} />
                </Box>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Téléphone (pour les SMS)</Typography>
                  <TextField
                    size="small"
                    placeholder="+33 6 12 34 56 78"
                    value={notifPhone}
                    onChange={(e) => setNotifPhone(e.target.value)}
                    fullWidth
                    sx={{ maxWidth: 400 }}
                  />
                </Box>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Événement</TableCell>
                      <TableCell align="center"><Email fontSize="small" /> Email</TableCell>
                      <TableCell align="center"><Sms fontSize="small" /> SMS</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(notifPrefs.events || []).map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell>{ev.label}</TableCell>
                        <TableCell align="center">
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={!!(notifPreferences[ev.id]?.email)}
                                onChange={(e) => handleNotifPrefChange(ev.id, 'email', e.target.checked)}
                              />
                            }
                            label=""
                          />
                        </TableCell>
                        <TableCell align="center">
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={!!(notifPreferences[ev.id]?.sms)}
                                onChange={(e) => handleNotifPrefChange(ev.id, 'sms', e.target.checked)}
                              />
                            }
                            label=""
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Box sx={{ mt: 2 }}>
                  <Button variant="contained" startIcon={<Save />} onClick={handleSaveNotifPrefs} disabled={notifSaving}>
                    {notifSaving ? 'Enregistrement…' : 'Enregistrer les préférences'}
                  </Button>
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {canViewAudit && tab === auditTabIndex && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Journal d'audit
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Historique des créations, modifications et suppressions sur les équipements et ordres de travail.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <TextField select size="small" label="Type d'entité" value={auditFilters.entityType} onChange={(e) => setAuditFilters((f) => ({ ...f, entityType: e.target.value }))} SelectProps={{ native: true }} sx={{ minWidth: 160 }}>
                <option value="">Tous</option>
                <option value="equipment">Équipement</option>
                <option value="work_order">Ordre de travail</option>
              </TextField>
              <TextField type="date" size="small" label="Début" value={auditFilters.startDate} onChange={(e) => setAuditFilters((f) => ({ ...f, startDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
              <TextField type="date" size="small" label="Fin" value={auditFilters.endDate} onChange={(e) => setAuditFilters((f) => ({ ...f, endDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
            </Box>
            {auditLoading ? (
              <Box display="flex" justifyContent="center" p={2}><CircularProgress /></Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Entité</TableCell>
                    <TableCell>ID</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Utilisateur</TableCell>
                    <TableCell>Résumé</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {auditLog.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.createdAt ? new Date(row.createdAt).toLocaleString('fr-FR') : '—'}</TableCell>
                      <TableCell>{row.entityType === 'work_order' ? 'OT' : row.entityType === 'equipment' ? 'Équipement' : row.entityType}</TableCell>
                      <TableCell>{row.entityId || '—'}</TableCell>
                      <TableCell>{row.action === 'created' ? 'Création' : row.action === 'updated' ? 'Modification' : 'Suppression'}</TableCell>
                      <TableCell>{row.userEmail || `User #${row.userId}` || '—'}</TableCell>
                      <TableCell>{row.summary || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!auditLoading && auditLog.length === 0 && (
              <Typography color="text.secondary">Aucun enregistrement d'audit sur la période.</Typography>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
