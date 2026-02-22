import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
} from '@mui/material';
import { Save, ArrowBack } from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';
import { useCurrency } from '../../context/CurrencyContext';
import projectNav from './projectNavigation';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'active', label: 'Actif' },
  { value: 'completed', label: 'Terminé' },
  { value: 'cancelled', label: 'Annulé' },
];

const initialForm = {
  name: '',
  description: '',
  budgetAmount: '',
  siteId: '',
  startDate: '',
  endDate: '',
  status: 'active',
};

export default function MaintenanceProjectForm() {
  const { id } = useParams();
  const location = useLocation();
  // Route "maintenance-projects/new" n'a pas de param :id, donc on détecte "new" via le pathname
  const isNew = location.pathname.endsWith('/new') || id === 'new';
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [sites, setSites] = useState([]);
  const [form, setForm] = useState(initialForm);
  const snackbar = useSnackbar();
  const currency = useCurrency();

  useEffect(() => {
    api.get('/sites').then((r) => setSites(Array.isArray(r.data) ? r.data : r.data?.data ?? [])).catch(() => setSites([]));
  }, []);

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }
    if (!id || id === 'undefined') {
      setLoading(false);
      projectNav.list();
      return;
    }
    setLoading(true);
    api
      .get(`/maintenance-projects/${id}`)
      .then((r) => {
        const p = r.data;
        setForm({
          name: p.name ?? '',
          description: p.description ?? '',
          budgetAmount: p.budgetAmount != null ? String(p.budgetAmount) : '',
          siteId: p.siteId ?? '',
          startDate: p.startDate ? p.startDate.slice(0, 10) : '',
          endDate: p.endDate ? p.endDate.slice(0, 10) : '',
          status: p.status ?? 'active',
        });
      })
      .catch(() => {
        snackbar.showError('Projet non trouvé');
        projectNav.list();
      })
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    const nameStr = (form.name && String(form.name).trim()) || '';
    if (!nameStr) {
      snackbar.showError('Le nom est requis');
      return;
    }
    const budgetNum = form.budgetAmount === '' || form.budgetAmount == null ? 0 : parseFloat(form.budgetAmount) || 0;
    const siteIdVal = form.siteId === '' || form.siteId == null ? null : parseInt(form.siteId, 10);
    const payload = {
      name: nameStr,
      description: (form.description && String(form.description).trim()) || undefined,
      budgetAmount: budgetNum,
      siteId: siteIdVal != null && !Number.isNaN(siteIdVal) ? siteIdVal : null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      status: form.status || 'active',
    };

    setSaving(true);
    if (isNew) {
      api
        .post('/maintenance-projects', payload)
        .then((r) => {
          const newId = r.data?.id;
          snackbar.showSuccess('Projet créé');
          if (newId != null) projectNav.detail(newId);
          else projectNav.list();
        })
        .catch((err) => {
          const msg = err.response?.data?.error || err.message || 'Erreur lors de la création';
          snackbar.showError(msg);
        })
        .finally(() => setSaving(false));
    } else {
      api
        .put(`/maintenance-projects/${id}`, payload)
        .then(() => {
          snackbar.showSuccess('Projet enregistré');
          projectNav.detail(id);
        })
        .catch((err) => {
          const msg = err.response?.data?.error || err.message || 'Erreur enregistrement';
          snackbar.showError(msg);
        })
        .finally(() => setSaving(false));
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => (isNew ? projectNav.list() : projectNav.detail(id))} sx={{ mb: 2 }}>
        Retour
      </Button>
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {isNew ? 'Nouveau projet' : 'Modifier le projet'}
          </Typography>
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Nom"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={2}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              margin="normal"
            />
            <TextField
              fullWidth
              label={`Budget (${currency})`}
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
              value={form.budgetAmount}
              onChange={(e) => setField('budgetAmount', e.target.value)}
              margin="normal"
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Site</InputLabel>
              <Select
                value={form.siteId === undefined ? '' : String(form.siteId)}
                label="Site"
                onChange={(e) => setField('siteId', e.target.value)}
              >
                <MenuItem value="">Aucun</MenuItem>
                {sites.map((s) => (
                  <MenuItem key={s.id} value={String(s.id)}>
                    {s.name || s.code}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              type="date"
              label="Date de début"
              value={form.startDate}
              onChange={(e) => setField('startDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              margin="normal"
            />
            <TextField
              fullWidth
              type="date"
              label="Date de fin"
              value={form.endDate}
              onChange={(e) => setField('endDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              margin="normal"
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Statut</InputLabel>
              <Select value={form.status} label="Statut" onChange={(e) => setField('status', e.target.value)}>
                {STATUS_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ mt: 2 }}>
              <Button type="submit" variant="contained" startIcon={<Save />} disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
