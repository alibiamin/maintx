import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  CircularProgress,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { ArrowBack, Delete, Add, ContentCopy, AttachMoney, Edit, Chat as ChatIcon } from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';

const statusColors = { operational: 'success', maintenance: 'warning', out_of_service: 'error', retired: 'default' };
const COUNTER_TYPES = [{ value: 'hours', label: 'Heures' }, { value: 'cycles', label: 'Cycles' }, { value: 'km', label: 'km' }];
const THRESHOLD_METRICS = [
  { value: 'hours', label: 'Heures' },
  { value: 'cycles', label: 'Cycles' },
  { value: 'temperature', label: 'Température' },
  { value: 'vibrations', label: 'Vibrations' },
  { value: 'pressure', label: 'Pression' },
  { value: 'custom', label: 'Personnalisé' }
];
const THRESHOLD_OPERATORS = [
  { value: '>=', label: '≥ (supérieur ou égal)' },
  { value: '>', label: '> (supérieur)' },
  { value: '<=', label: '≤ (inférieur ou égal)' },
  { value: '<', label: '< (inférieur)' },
  { value: '=', label: '= (égal)' }
];

export default function EquipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const [equipment, setEquipment] = useState(null);
  const [history, setHistory] = useState([]);
  const [counters, setCounters] = useState([]);
  const [counterForm, setCounterForm] = useState({ type: 'hours', value: '' });
  const [thresholds, setThresholds] = useState([]);
  const [thresholdForm, setThresholdForm] = useState({ metric: 'hours', thresholdValue: '', operator: '>=' });
  const [bom, setBom] = useState([]);
  const [spareParts, setSpareParts] = useState([]);
  const [bomForm, setBomForm] = useState({ sparePartId: '', quantity: 1 });
  const [bomSubmitting, setBomSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [counterSubmitting, setCounterSubmitting] = useState(false);
  const [thresholdSubmitting, setThresholdSubmitting] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneForm, setCloneForm] = useState({ code: '', name: '', copyBom: true, copyPlans: true });
  const [cloneSubmitting, setCloneSubmitting] = useState(false);
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [assetForm, setAssetForm] = useState({ acquisitionValue: '', depreciationYears: '', residualValue: '', depreciationStartDate: '' });
  const [assetSubmitting, setAssetSubmitting] = useState(false);
  const [editMainOpen, setEditMainOpen] = useState(false);
  const [editMainForm, setEditMainForm] = useState({ code: '', name: '', description: '', categoryId: '', ligneId: '', parentId: '', serialNumber: '', manufacturer: '', model: '', location: '', criticite: 'B', status: 'operational', installationDate: '' });
  const [categories, setCategories] = useState([]);
  const [lignes, setLignes] = useState([]);
  const [parentEquipmentList, setParentEquipmentList] = useState([]);
  const [editMainSubmitting, setEditMainSubmitting] = useState(false);
  const [costPerHourInput, setCostPerHourInput] = useState('');
  const [costPerHourSubmitting, setCostPerHourSubmitting] = useState(false);
  const [thresholdToDelete, setThresholdToDelete] = useState(null);
  const [bomLineToDelete, setBomLineToDelete] = useState(null); // { sparePartId, partName } | null
  const { user, can } = useAuth();
  const currency = useCurrency();
  const canEditEquipment = can('equipment', 'update');

  const numId = id != null && /^\d+$/.test(String(id)) ? String(id) : null;

  const fetchCounters = () => {
    if (!numId) return;
    api.get(`/equipment/${numId}/counters`).then((r) => setCounters(Array.isArray(r.data) ? r.data : [])).catch(() => setCounters([]));
  };
  const fetchThresholds = () => {
    if (!numId) return;
    api.get(`/equipment/${numId}/thresholds`).then((r) => setThresholds(Array.isArray(r.data) ? r.data : [])).catch(() => setThresholds([]));
  };
  const fetchBom = () => {
    if (!numId) return;
    api.get(`/equipment/${numId}/bom`).then((r) => setBom(Array.isArray(r.data) ? r.data : [])).catch(() => setBom([]));
  };

  useEffect(() => {
    if (id === 'new') {
      navigate('/app/equipment/creation/machine', { replace: true });
      return;
    }
    if (!numId) {
      setLoading(false);
      navigate('/app/equipment');
      return;
    }
    setLoading(true);
    Promise.all([
      api.get(`/equipment/${numId}`),
      api.get(`/equipment/${numId}/history`),
      api.get(`/equipment/${numId}/counters`).catch(() => ({ data: [] })),
      api.get(`/equipment/${numId}/thresholds`).catch(() => ({ data: [] })),
      api.get(`/equipment/${numId}/bom`).catch(() => ({ data: [] })),
      api.get('/stock/parts').catch(() => ({ data: [] }))
    ])
      .then(([eq, hist, cnt, th, bomRes, partsRes]) => {
        setEquipment(eq.data);
        setHistory(Array.isArray(hist.data) ? hist.data : []);
        setCounters(Array.isArray(cnt?.data) ? cnt.data : []);
        setThresholds(Array.isArray(th?.data) ? th.data : []);
        setBom(Array.isArray(bomRes?.data) ? bomRes.data : []);
        const parts = partsRes?.data?.data ?? partsRes?.data ?? [];
        setSpareParts(Array.isArray(parts) ? parts : []);
      })
      .catch((err) => {
        if (err.response?.status === 404) navigate('/app/equipment');
        else setEquipment(null);
      })
      .finally(() => setLoading(false));
  }, [id, numId, navigate]);

  useEffect(() => {
    if (equipment?.targetCostPerOperatingHour != null) setCostPerHourInput(String(equipment.targetCostPerOperatingHour));
    else setCostPerHourInput('');
  }, [equipment?.targetCostPerOperatingHour]);

  const updateCounter = (counterType, value) => {
    if (!numId) return;
    const v = parseFloat(value);
    if (Number.isNaN(v) || v < 0) {
      snackbar.showError('Valeur invalide');
      return;
    }
    setCounterSubmitting(true);
    api.put(`/equipment/${numId}/counters`, { counterType, value: v })
      .then(() => {
        snackbar.showSuccess('Compteur enregistré');
        setCounterForm((f) => ({ ...f, value: '' }));
        fetchCounters();
      })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur lors de l\'enregistrement'))
      .finally(() => setCounterSubmitting(false));
  };

  const addThreshold = () => {
    if (!numId) return;
    const v = parseFloat(thresholdForm.thresholdValue);
    if (Number.isNaN(v)) {
      snackbar.showError('Valeur du seuil invalide');
      return;
    }
    setThresholdSubmitting(true);
    api.post(`/equipment/${numId}/thresholds`, {
      metric: thresholdForm.metric,
      thresholdValue: v,
      operator: thresholdForm.operator
    })
      .then(() => {
        snackbar.showSuccess('Seuil ajouté');
        setThresholdForm({ metric: 'hours', thresholdValue: '', operator: '>=' });
        fetchThresholds();
      })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur lors de l\'ajout'))
      .finally(() => setThresholdSubmitting(false));
  };

  const deleteThreshold = (tid) => {
    if (!numId || !tid) return;
    api.delete(`/equipment/${numId}/thresholds/${tid}`)
      .then(() => {
        snackbar.showSuccess('Seuil supprimé');
        fetchThresholds();
        setThresholdToDelete(null);
      })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur'));
  };

  const addBomLine = () => {
    if (!numId || !bomForm.sparePartId) return;
    setBomSubmitting(true);
    api.post(`/equipment/${numId}/bom`, { sparePartId: Number(bomForm.sparePartId), quantity: Number(bomForm.quantity) || 1 })
      .then(() => {
        snackbar.showSuccess('Pièce ajoutée à la nomenclature');
        setBomForm({ sparePartId: '', quantity: 1 });
        fetchBom();
      })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur'))
      .finally(() => setBomSubmitting(false));
  };

  const removeBomLine = (sparePartId) => {
    if (!numId || !sparePartId) return;
    api.delete(`/equipment/${numId}/bom/${sparePartId}`)
      .then(() => {
        snackbar.showSuccess('Pièce retirée de la nomenclature');
        fetchBom();
        setBomLineToDelete(null);
      })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur'));
  };
  const confirmRemoveBomLine = () => {
    if (bomLineToDelete?.sparePartId) removeBomLine(bomLineToDelete.sparePartId);
  };

  const openCloneDialog = () => {
    setCloneForm({ code: '', name: `${equipment?.name || ''} (copie)`, copyBom: true, copyPlans: true });
    setCloneDialogOpen(true);
  };

  const handleClone = () => {
    if (!cloneForm.code.trim() || !cloneForm.name.trim()) {
      snackbar.showError('Code et nom requis');
      return;
    }
    setCloneSubmitting(true);
    api.post(`/equipment/${numId}/clone`, {
      code: cloneForm.code.trim(),
      name: cloneForm.name.trim(),
      copyBom: cloneForm.copyBom,
      copyPlans: cloneForm.copyPlans
    })
      .then((r) => {
        snackbar.showSuccess('Équipement cloné');
        setCloneDialogOpen(false);
        navigate(`/app/equipment/${r.data.id}`);
      })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setCloneSubmitting(false));
  };

  const computeBookValue = () => {
    const acq = Number(equipment?.acquisitionValue);
    const res = Number(equipment?.residualValue) || 0;
    const years = Number(equipment?.depreciationYears) || 0;
    if (!acq || acq <= 0 || !years) return null;
    const start = equipment?.depreciationStartDate ? new Date(equipment.depreciationStartDate) : equipment?.installationDate ? new Date(equipment.installationDate) : new Date();
    const elapsed = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    const depreciable = acq - res;
    const depreciated = Math.min(elapsed / years, 1) * depreciable;
    return Math.max(acq - depreciated, res);
  };

  const openAssetDialog = () => {
    setAssetForm({
      acquisitionValue: equipment?.acquisitionValue ?? '',
      depreciationYears: equipment?.depreciationYears ?? '',
      residualValue: equipment?.residualValue ?? '',
      depreciationStartDate: equipment?.depreciationStartDate ? equipment.depreciationStartDate.slice(0, 10) : ''
    });
    setAssetDialogOpen(true);
  };

  const openEditMainDialog = () => {
    setEditMainForm({
      code: equipment?.code ?? '',
      name: equipment?.name ?? '',
      description: equipment?.description ?? '',
      categoryId: equipment?.categoryId != null ? String(equipment.categoryId) : '',
      ligneId: equipment?.ligneId != null ? String(equipment.ligneId) : '',
      parentId: equipment?.parentId != null ? String(equipment.parentId) : '',
      serialNumber: equipment?.serialNumber ?? '',
      manufacturer: equipment?.manufacturer ?? '',
      model: equipment?.model ?? '',
      location: equipment?.location ?? '',
      criticite: equipment?.criticite ?? 'B',
      status: equipment?.status ?? 'operational',
      installationDate: equipment?.installationDate ? equipment.installationDate.slice(0, 10) : ''
    });
    setEditMainOpen(true);
    Promise.all([
      api.get('/equipment/categories').then((r) => setCategories(r.data || [])).catch(() => setCategories([])),
      api.get('/lignes').then((r) => setLignes(r.data || [])).catch(() => setLignes([])),
      api.get('/equipment', { params: { limit: 500 } }).then((r) => {
        const list = r.data?.data ?? r.data ?? [];
        setParentEquipmentList(Array.isArray(list) ? list.filter((e) => e.id !== equipment?.id) : []);
      }).catch(() => setParentEquipmentList([]))
    ]);
  };

  const handleSaveEditMain = () => {
    if (!numId) return;
    setEditMainSubmitting(true);
    const payload = {
      code: editMainForm.code.trim(),
      name: editMainForm.name.trim(),
      description: editMainForm.description.trim() || undefined,
      categoryId: editMainForm.categoryId ? parseInt(editMainForm.categoryId, 10) : undefined,
      ligneId: editMainForm.ligneId ? parseInt(editMainForm.ligneId, 10) : undefined,
      parentId: editMainForm.parentId === '' ? undefined : (editMainForm.parentId ? parseInt(editMainForm.parentId, 10) : null),
      serialNumber: editMainForm.serialNumber.trim() || undefined,
      manufacturer: editMainForm.manufacturer.trim() || undefined,
      model: editMainForm.model.trim() || undefined,
      location: editMainForm.location.trim() || undefined,
      criticite: editMainForm.criticite,
      status: editMainForm.status,
      installationDate: editMainForm.installationDate || undefined
    };
    api.put(`/equipment/${numId}`, payload)
      .then((r) => { setEquipment(r.data); setEditMainOpen(false); snackbar.showSuccess('Équipement enregistré'); })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setEditMainSubmitting(false));
  };

  const handleSaveAsset = () => {
    setAssetSubmitting(true);
    api.put(`/equipment/${numId}`, {
      acquisitionValue: assetForm.acquisitionValue === '' ? null : parseFloat(assetForm.acquisitionValue),
      depreciationYears: assetForm.depreciationYears === '' ? null : parseInt(assetForm.depreciationYears, 10),
      residualValue: assetForm.residualValue === '' ? null : parseFloat(assetForm.residualValue),
      depreciationStartDate: assetForm.depreciationStartDate || null
    })
      .then((r) => { setEquipment(r.data); setAssetDialogOpen(false); snackbar.showSuccess('Immobilisation enregistrée'); })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setAssetSubmitting(false));
  };

  const bookValue = computeBookValue();

  if (loading || !equipment) return <Box p={4}><CircularProgress /></Box>;

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} sx={{ mb: 2 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/app/equipment')}>Retour</Button>
        <Button startIcon={<ChatIcon />} variant="outlined" onClick={() => navigate(`/app/chat?createEq=${equipment?.id}`)} title="Discuter avec l’équipe sur cet équipement">
          Discuter
        </Button>
        {canEditEquipment && (
          <>
            <Button startIcon={<Edit />} variant="outlined" onClick={openEditMainDialog}>Modifier</Button>
            <Button startIcon={<ContentCopy />} variant="outlined" onClick={openCloneDialog}>Cloner</Button>
          </>
        )}
      </Box>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
            <Box>
              <Typography variant="h5">{equipment.name}</Typography>
              <Typography color="text.secondary">{equipment.code}</Typography>
              <Chip label={equipment.status} color={statusColors[equipment.status]} size="small" sx={{ mt: 1 }} />
            </Box>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">Catégorie</Typography>
              <Typography>{equipment.categoryName || '-'}</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">N° série</Typography>
              <Typography>{equipment.serialNumber || '-'}</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">Constructeur / Modèle</Typography>
              <Typography>{[equipment.manufacturer, equipment.model].filter(Boolean).join(' - ') || '-'}</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">Localisation</Typography>
              <Typography>{equipment.location || '-'}</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">Date d'installation</Typography>
              <Typography>{equipment.installationDate || '-'}</Typography>
            </Grid>
            {equipment.description && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                <Typography>{equipment.description}</Typography>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><AttachMoney /> Immobilisation / Actif</Typography>
            {canEditEquipment && <Button size="small" variant="outlined" onClick={openAssetDialog}>Modifier</Button>}
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" color="text.secondary">Valeur d'acquisition</Typography>
              <Typography>{equipment.acquisitionValue != null ? `${Number(equipment.acquisitionValue).toLocaleString('fr-FR')} ${currency}` : '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" color="text.secondary">Durée amort. (années)</Typography>
              <Typography>{equipment.depreciationYears ?? '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" color="text.secondary">Valeur résiduelle</Typography>
              <Typography>{equipment.residualValue != null ? `${Number(equipment.residualValue).toLocaleString('fr-FR')} ${currency}` : '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" color="text.secondary">Début amortissement</Typography>
              <Typography>{equipment.depreciationStartDate ? new Date(equipment.depreciationStartDate).toLocaleDateString('fr-FR') : '—'}</Typography>
            </Grid>
            {bookValue != null && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Valeur nette comptable (estimée)</Typography>
                <Typography fontWeight={600}>{bookValue.toLocaleString('fr-FR')} {currency}</Typography>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
            <Typography variant="h6">Coût par heure de fonctionnement</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Objectif de coût par heure d&apos;utilisation (utilisé dans le rapport Coût / h fonctionnement pour comparer au coût réel).
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Objectif actuel</Typography>
              <Typography>{equipment.targetCostPerOperatingHour != null ? `${Number(equipment.targetCostPerOperatingHour).toLocaleString('fr-FR')} ${currency} / h` : '—'}</Typography>
            </Grid>
            {canEditEquipment && (
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  type="number"
                  size="small"
                  label="Objectif (coût / h)"
                  value={costPerHourInput}
                  onChange={(e) => setCostPerHourInput(e.target.value)}
                  inputProps={{ min: 0, step: 0.01 }}
                  sx={{ width: 200 }}
                  placeholder={`${currency} / h`}
                />
              </Grid>
            )}
            {canEditEquipment && (
              <Grid item xs={12} sm={6} md={4}>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={costPerHourSubmitting}
                  onClick={() => {
                    const v = costPerHourInput.trim();
                    const num = v === '' ? null : parseFloat(v);
                    if (num !== null && (Number.isNaN(num) || num < 0)) {
                      snackbar.showError('Valeur invalide');
                      return;
                    }
                    setCostPerHourSubmitting(true);
                    api.put(`/equipment/${numId}`, { targetCostPerOperatingHour: num })
                      .then((r) => { setEquipment(r.data); snackbar.showSuccess('Objectif coût / h enregistré'); setCostPerHourInput(r.data.targetCostPerOperatingHour != null ? String(r.data.targetCostPerOperatingHour) : ''); })
                      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
                      .finally(() => setCostPerHourSubmitting(false));
                  }}
                >
                  Enregistrer
                </Button>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Compteurs (maintenance conditionnelle)</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
            <TextField select size="small" label="Type" value={counterForm.type} onChange={(e) => setCounterForm((f) => ({ ...f, type: e.target.value }))} SelectProps={{ native: true }} sx={{ minWidth: 120 }}>
              {COUNTER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </TextField>
            <TextField type="number" size="small" label="Valeur" value={counterForm.value} onChange={(e) => setCounterForm((f) => ({ ...f, value: e.target.value }))} inputProps={{ min: 0, step: 0.1 }} sx={{ width: 120 }} />
            <Button variant="outlined" size="small" onClick={() => updateCounter(counterForm.type, counterForm.value)} disabled={counterSubmitting || counterForm.value === ''}>
              Mettre à jour
            </Button>
          </Box>
          {counters.length === 0 ? (
            <Typography color="text.secondary">Aucun compteur enregistré. Choisissez un type (heures, cycles, km), saisissez une valeur ci-dessus puis cliquez sur « Mettre à jour ».</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Valeur</TableCell>
                  <TableCell>Unité</TableCell>
                  <TableCell>Dernière MAJ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {counters.map((c) => (
                  <TableRow key={c.counterType}>
                    <TableCell>{COUNTER_TYPES.find((t) => t.value === c.counterType)?.label || c.counterType}</TableCell>
                    <TableCell>{c.value}</TableCell>
                    <TableCell>{c.unit || 'h'}</TableCell>
                    <TableCell>{c.updatedAt ? new Date(c.updatedAt).toLocaleString('fr-FR') : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Seuils IoT / prévisionnel</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Métrique</InputLabel>
              <Select value={thresholdForm.metric} label="Métrique" onChange={(e) => setThresholdForm((f) => ({ ...f, metric: e.target.value }))}>
                {THRESHOLD_METRICS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Opérateur</InputLabel>
              <Select value={thresholdForm.operator} label="Opérateur" onChange={(e) => setThresholdForm((f) => ({ ...f, operator: e.target.value }))}>
                {THRESHOLD_OPERATORS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField type="number" size="small" label="Valeur seuil" value={thresholdForm.thresholdValue} onChange={(e) => setThresholdForm((f) => ({ ...f, thresholdValue: e.target.value }))} inputProps={{ min: 0, step: 0.01 }} sx={{ width: 120 }} />
            <Button variant="contained" size="small" onClick={addThreshold} disabled={thresholdSubmitting || thresholdForm.thresholdValue === ''}>
              Ajouter un seuil
            </Button>
          </Box>
          {thresholds.length === 0 ? (
            <Typography color="text.secondary">Aucun seuil. Ajoutez un seuil ci-dessus (ex. heures ≥ 5000) ; les alertes seront créées lorsqu'ils sont dépassés.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Métrique</TableCell>
                  <TableCell>Opérateur</TableCell>
                  <TableCell>Seuil</TableCell>
                  <TableCell>Dernier déclenchement</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {thresholds.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{THRESHOLD_METRICS.find((m) => m.value === t.metric)?.label || t.metric}</TableCell>
                    <TableCell>{t.operator}</TableCell>
                    <TableCell>{t.thresholdValue}</TableCell>
                    <TableCell>{t.lastTriggeredAt ? new Date(t.lastTriggeredAt).toLocaleString('fr-FR') : '—'}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="error" onClick={() => setThresholdToDelete(t.id)} title="Supprimer"><Delete /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Nomenclature (BOM)</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Pièce</InputLabel>
              <Select
                value={bomForm.sparePartId}
                label="Pièce"
                onChange={(e) => setBomForm((f) => ({ ...f, sparePartId: e.target.value }))}
              >
                <MenuItem value="">Sélectionner une pièce</MenuItem>
                {spareParts.map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.code} – {p.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField type="number" size="small" label="Quantité" value={bomForm.quantity} onChange={(e) => setBomForm((f) => ({ ...f, quantity: e.target.value }))} inputProps={{ min: 1 }} sx={{ width: 100 }} />
            <Button variant="outlined" size="small" startIcon={<Add />} onClick={addBomLine} disabled={bomSubmitting || !bomForm.sparePartId}>
              Ajouter
            </Button>
          </Box>
          {bom.length === 0 ? (
            <Typography color="text.secondary">Aucune pièce en nomenclature. Ajoutez des pièces pour cet équipement (kit d'intervention, pièces critiques).</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Désignation</TableCell>
                  <TableCell align="right">Quantité</TableCell>
                  <TableCell align="right">Prix unitaire</TableCell>
                  <TableCell align="right">Stock</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bom.map((row) => (
                  <TableRow key={row.sparePartId}>
                    <TableCell>{row.partCode}</TableCell>
                    <TableCell>{row.partName}</TableCell>
                    <TableCell align="right">{row.quantity}</TableCell>
                    <TableCell align="right">{row.unitPrice != null ? `${Number(row.unitPrice).toFixed(2)} ${currency}` : '—'}</TableCell>
                    <TableCell align="right">{row.stockQuantity ?? '—'}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="error" onClick={() => setBomLineToDelete({ sparePartId: row.sparePartId, partName: row.partName || row.partCode })} title="Retirer"><Delete /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Historique des interventions</Typography>
          {history.length === 0 ? (
            <Typography color="text.secondary">Aucune intervention enregistrée</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>N° OT</TableCell>
                  <TableCell>Titre</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell>Technicien</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((wo) => (
                  <TableRow key={wo.id}>
                    <TableCell><Button size="small" onClick={() => navigate(`/app/work-orders/${wo.id}`)}>{wo.number}</Button></TableCell>
                    <TableCell>{wo.title}</TableCell>
                    <TableCell>{wo.type_name}</TableCell>
                    <TableCell><Chip label={wo.status} size="small" /></TableCell>
                    <TableCell>{wo.assigned_name || '-'}</TableCell>
                    <TableCell>{new Date(wo.created_at).toLocaleDateString('fr-FR')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={assetDialogOpen} onClose={() => setAssetDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Immobilisation / Actif</DialogTitle>
        <DialogContent>
          <TextField fullWidth type="number" inputProps={{ min: 0, step: 0.01 }} label={`Valeur d'acquisition (${currency})`} value={assetForm.acquisitionValue} onChange={(e) => setAssetForm((f) => ({ ...f, acquisitionValue: e.target.value }))} margin="normal" />
          <TextField fullWidth type="number" inputProps={{ min: 0 }} label="Durée d'amortissement (années)" value={assetForm.depreciationYears} onChange={(e) => setAssetForm((f) => ({ ...f, depreciationYears: e.target.value }))} margin="normal" />
          <TextField fullWidth type="number" inputProps={{ min: 0, step: 0.01 }} label={`Valeur résiduelle (${currency})`} value={assetForm.residualValue} onChange={(e) => setAssetForm((f) => ({ ...f, residualValue: e.target.value }))} margin="normal" />
          <TextField fullWidth type="date" label="Début amortissement" value={assetForm.depreciationStartDate} onChange={(e) => setAssetForm((f) => ({ ...f, depreciationStartDate: e.target.value }))} InputLabelProps={{ shrink: true }} margin="normal" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssetDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSaveAsset} disabled={assetSubmitting}>Enregistrer</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={cloneDialogOpen} onClose={() => setCloneDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cloner cet équipement</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Code" value={cloneForm.code} onChange={(e) => setCloneForm((f) => ({ ...f, code: e.target.value }))} required margin="normal" />
          <TextField fullWidth label="Nom" value={cloneForm.name} onChange={(e) => setCloneForm((f) => ({ ...f, name: e.target.value }))} required margin="normal" />
          <FormControlLabel control={<Checkbox checked={cloneForm.copyBom} onChange={(e) => setCloneForm((f) => ({ ...f, copyBom: e.target.checked }))} />} label="Copier la nomenclature (BOM)" />
          <FormControlLabel control={<Checkbox checked={cloneForm.copyPlans} onChange={(e) => setCloneForm((f) => ({ ...f, copyPlans: e.target.checked }))} />} label="Copier les plans de maintenance" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloneDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleClone} disabled={cloneSubmitting || !cloneForm.code.trim() || !cloneForm.name.trim()}>Cloner</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editMainOpen} onClose={() => setEditMainOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Modifier l&apos;équipement</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="Code" value={editMainForm.code} onChange={(e) => setEditMainForm((f) => ({ ...f, code: e.target.value }))} fullWidth required />
          <TextField label="Nom" value={editMainForm.name} onChange={(e) => setEditMainForm((f) => ({ ...f, name: e.target.value }))} fullWidth required />
          <TextField label="Description" value={editMainForm.description} onChange={(e) => setEditMainForm((f) => ({ ...f, description: e.target.value }))} fullWidth multiline minRows={2} />
          <FormControl fullWidth size="small">
            <InputLabel>Catégorie</InputLabel>
            <Select value={editMainForm.categoryId} label="Catégorie" onChange={(e) => setEditMainForm((f) => ({ ...f, categoryId: e.target.value }))}>
              <MenuItem value="">—</MenuItem>
              {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Ligne</InputLabel>
            <Select value={editMainForm.ligneId} label="Ligne" onChange={(e) => setEditMainForm((f) => ({ ...f, ligneId: e.target.value }))}>
              <MenuItem value="">—</MenuItem>
              {lignes.map((l) => <MenuItem key={l.id} value={l.id}>{l.name} {l.code ? `(${l.code})` : ''}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Parent (section / machine)</InputLabel>
            <Select value={editMainForm.parentId} label="Parent (section / machine)" onChange={(e) => setEditMainForm((f) => ({ ...f, parentId: e.target.value }))}>
              <MenuItem value="">— Aucun —</MenuItem>
              {parentEquipmentList.map((e) => <MenuItem key={e.id} value={e.id}>{e.code} — {e.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="N° série" value={editMainForm.serialNumber} onChange={(e) => setEditMainForm((f) => ({ ...f, serialNumber: e.target.value }))} fullWidth />
          <TextField label="Constructeur" value={editMainForm.manufacturer} onChange={(e) => setEditMainForm((f) => ({ ...f, manufacturer: e.target.value }))} fullWidth />
          <TextField label="Modèle" value={editMainForm.model} onChange={(e) => setEditMainForm((f) => ({ ...f, model: e.target.value }))} fullWidth />
          <TextField label="Localisation" value={editMainForm.location} onChange={(e) => setEditMainForm((f) => ({ ...f, location: e.target.value }))} fullWidth />
          <FormControl fullWidth size="small">
            <InputLabel>Criticité</InputLabel>
            <Select value={editMainForm.criticite} label="Criticité" onChange={(e) => setEditMainForm((f) => ({ ...f, criticite: e.target.value }))}>
              <MenuItem value="A">A</MenuItem>
              <MenuItem value="B">B</MenuItem>
              <MenuItem value="C">C</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Statut</InputLabel>
            <Select value={editMainForm.status} label="Statut" onChange={(e) => setEditMainForm((f) => ({ ...f, status: e.target.value }))}>
              <MenuItem value="operational">Opérationnel</MenuItem>
              <MenuItem value="maintenance">En maintenance</MenuItem>
              <MenuItem value="out_of_service">Hors service</MenuItem>
              <MenuItem value="retired">Retiré</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Date d'installation" type="date" value={editMainForm.installationDate} onChange={(e) => setEditMainForm((f) => ({ ...f, installationDate: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditMainOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSaveEditMain} disabled={editMainSubmitting || !editMainForm.code.trim() || !editMainForm.name.trim()}>Enregistrer</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={thresholdToDelete != null} onClose={() => setThresholdToDelete(null)}>
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <DialogContentText>Supprimer ce seuil d&apos;alerte ? Cette action est irréversible.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setThresholdToDelete(null)}>Annuler</Button>
          <Button color="error" variant="contained" onClick={() => { deleteThreshold(thresholdToDelete); setThresholdToDelete(null); }}>Supprimer</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bomLineToDelete != null} onClose={() => setBomLineToDelete(null)}>
        <DialogTitle>Retirer de la nomenclature</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Retirer la pièce « {bomLineToDelete?.partName || 'cette pièce'} » de la nomenclature de cet équipement ?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBomLineToDelete(null)}>Annuler</Button>
          <Button color="error" variant="contained" onClick={confirmRemoveBomLine}>Retirer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
