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
  DialogActions,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { ArrowBack, Delete, Add, ContentCopy, AttachMoney } from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';
import { useAuth } from '../../context/AuthContext';

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
  const { user } = useAuth();
  const canEditEquipment = ['administrateur', 'responsable_maintenance'].includes(user?.role);

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
      navigate('/creation', { replace: true });
      return;
    }
    if (!numId) {
      setLoading(false);
      navigate('/equipment');
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
        if (err.response?.status === 404) navigate('/equipment');
        else setEquipment(null);
      })
      .finally(() => setLoading(false));
  }, [id, numId, navigate]);

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
      })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur'));
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
        navigate(`/equipment/${r.data.id}`);
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
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/equipment')}>Retour</Button>
        {canEditEquipment && (
          <Button startIcon={<ContentCopy />} variant="outlined" onClick={openCloneDialog}>Cloner</Button>
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
              <Typography>{equipment.acquisitionValue != null ? `${Number(equipment.acquisitionValue).toLocaleString('fr-FR')} €` : '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" color="text.secondary">Durée amort. (années)</Typography>
              <Typography>{equipment.depreciationYears ?? '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" color="text.secondary">Valeur résiduelle</Typography>
              <Typography>{equipment.residualValue != null ? `${Number(equipment.residualValue).toLocaleString('fr-FR')} €` : '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" color="text.secondary">Début amortissement</Typography>
              <Typography>{equipment.depreciationStartDate ? new Date(equipment.depreciationStartDate).toLocaleDateString('fr-FR') : '—'}</Typography>
            </Grid>
            {bookValue != null && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Valeur nette comptable (estimée)</Typography>
                <Typography fontWeight={600}>{bookValue.toLocaleString('fr-FR')} €</Typography>
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
                      <IconButton size="small" color="error" onClick={() => deleteThreshold(t.id)} title="Supprimer"><Delete /></IconButton>
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
                    <TableCell align="right">{row.unitPrice != null ? `${Number(row.unitPrice).toFixed(2)} €` : '—'}</TableCell>
                    <TableCell align="right">{row.stockQuantity ?? '—'}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="error" onClick={() => removeBomLine(row.sparePartId)} title="Retirer"><Delete /></IconButton>
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
                    <TableCell><Button size="small" onClick={() => navigate(`/work-orders/${wo.id}`)}>{wo.number}</Button></TableCell>
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
          <TextField fullWidth type="number" inputProps={{ min: 0, step: 0.01 }} label="Valeur d'acquisition (€)" value={assetForm.acquisitionValue} onChange={(e) => setAssetForm((f) => ({ ...f, acquisitionValue: e.target.value }))} margin="normal" />
          <TextField fullWidth type="number" inputProps={{ min: 0 }} label="Durée d'amortissement (années)" value={assetForm.depreciationYears} onChange={(e) => setAssetForm((f) => ({ ...f, depreciationYears: e.target.value }))} margin="normal" />
          <TextField fullWidth type="number" inputProps={{ min: 0, step: 0.01 }} label="Valeur résiduelle (€)" value={assetForm.residualValue} onChange={(e) => setAssetForm((f) => ({ ...f, residualValue: e.target.value }))} margin="normal" />
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
    </Box>
  );
}
