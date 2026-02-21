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
  IconButton
} from '@mui/material';
import { ArrowBack, Delete } from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';

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
  const [loading, setLoading] = useState(true);
  const [counterSubmitting, setCounterSubmitting] = useState(false);
  const [thresholdSubmitting, setThresholdSubmitting] = useState(false);

  const numId = id != null && /^\d+$/.test(String(id)) ? String(id) : null;

  const fetchCounters = () => {
    if (!numId) return;
    api.get(`/equipment/${numId}/counters`).then((r) => setCounters(Array.isArray(r.data) ? r.data : [])).catch(() => setCounters([]));
  };
  const fetchThresholds = () => {
    if (!numId) return;
    api.get(`/equipment/${numId}/thresholds`).then((r) => setThresholds(Array.isArray(r.data) ? r.data : [])).catch(() => setThresholds([]));
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
      api.get(`/equipment/${numId}/thresholds`).catch(() => ({ data: [] }))
    ])
      .then(([eq, hist, cnt, th]) => {
        setEquipment(eq.data);
        setHistory(Array.isArray(hist.data) ? hist.data : []);
        setCounters(Array.isArray(cnt?.data) ? cnt.data : []);
        setThresholds(Array.isArray(th?.data) ? th.data : []);
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

  if (loading || !equipment) return <Box p={4}><CircularProgress /></Box>;

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/equipment')} sx={{ mb: 2 }}>Retour</Button>
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
    </Box>
  );
}
