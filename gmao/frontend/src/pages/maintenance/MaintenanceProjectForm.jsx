import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, Typography
} from '@mui/material';
import { Save, ArrowBack } from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'active', label: 'Actif' },
  { value: 'completed', label: 'Terminé' },
  { value: 'cancelled', label: 'Annulé' }
];

export default function MaintenanceProjectForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [sites, setSites] = useState([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    budgetAmount: '',
    siteId: '',
    startDate: '',
    endDate: '',
    status: 'active'
  });

  const snackbar = useSnackbar();

  useEffect(() => {
    api.get('/sites').then((r) => setSites(Array.isArray(r.data) ? r.data : r.data?.data ?? [])).catch(() => setSites([]));
  }, []);

  useEffect(() => {
    if (isNew) { setLoading(false); return; }
    if (!id || id === 'undefined') {
      setLoading(false);
      navigate('/maintenance-projects', { replace: true });
      return;
    }
    api.get(`/maintenance-projects/${id}`)
      .then((r) => {
        const p = r.data;
        setForm({
          name: p.name || '',
          description: p.description || '',
          budgetAmount: p.budgetAmount != null ? String(p.budgetAmount) : '',
          siteId: p.siteId ?? '',
          startDate: p.startDate ? p.startDate.slice(0, 10) : '',
          endDate: p.endDate ? p.endDate.slice(0, 10) : '',
          status: p.status || 'active'
        });
      })
      .catch(() => snackbar.showError('Projet non trouvé'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const nameStr = (form.name && String(form.name).trim()) || '';
    if (!nameStr) { snackbar.showError('Le nom est requis'); return; }
    const budgetNum = form.budgetAmount === '' || form.budgetAmount == null ? 0 : (parseFloat(form.budgetAmount) || 0);
    const siteIdVal = form.siteId === '' || form.siteId == null ? null : (parseInt(form.siteId, 10));
    const payload = {
      name: nameStr,
      description: (form.description && String(form.description).trim()) || undefined,
      budgetAmount: budgetNum,
      siteId: (siteIdVal != null && !Number.isNaN(siteIdVal)) ? siteIdVal : null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      status: form.status || 'active'
    };
    setSaving(true);
    if (isNew) {
      api.post('/maintenance-projects', payload)
        .then((r) => {
          const id = r.data?.id ?? r.data?.projectId ?? r.data?.data?.id;
          const numId = id != null && id !== '' && !Number.isNaN(Number(id)) ? Number(id) : null;
          snackbar.showSuccess('Projet créé');
          navigate(numId != null ? `/maintenance-projects/${numId}` : '/maintenance-projects');
        })
        .catch((e) => {
          const status = e.response?.status;
          const data = e.response?.data;
          let msg = data?.error || (Array.isArray(data?.errors) && data.errors[0]?.msg) || '';
          if (status === 403) msg = msg || 'Droits insuffisants pour créer un projet.';
          if (status === 501) msg = msg || 'Table absente : exécutez les migrations.';
          if (!msg) msg = e.message || 'Erreur lors de la création.';
          snackbar.showError(msg);
        })
        .finally(() => setSaving(false));
    } else {
      api.put(`/maintenance-projects/${id}`, payload)
        .then(() => { snackbar.showSuccess('Projet enregistré'); navigate(`/maintenance-projects/${id}`); })
        .catch((e) => {
          const data = e.response?.data;
          const msg = data?.error || (Array.isArray(data?.errors) && data.errors[0]?.msg) || 'Erreur enregistrement';
          snackbar.showError(msg);
        })
        .finally(() => setSaving(false));
    }
  };

  if (loading) {
    return <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(isNew ? '/maintenance-projects' : `/maintenance-projects/${id}`)} sx={{ mb: 2 }}>
        Retour
      </Button>
      <Card>
        <CardContent>
          <Typography component="h2" variant="h6" sx={{ mb: 2 }}>{isNew ? 'Nouveau projet' : 'Modifier le projet'}</Typography>
          <form onSubmit={handleSubmit}>
            <TextField fullWidth label="Nom" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required margin="normal" />
            <TextField fullWidth label="Description" multiline rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} margin="normal" />
            <TextField fullWidth label="Budget (€)" type="number" inputProps={{ min: 0, step: 0.01 }} value={form.budgetAmount} onChange={(e) => setForm((f) => ({ ...f, budgetAmount: e.target.value }))} margin="normal" />
            <FormControl fullWidth margin="normal">
              <InputLabel>Site</InputLabel>
              <Select value={form.siteId === undefined ? '' : String(form.siteId)} label="Site" onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))}>
                <MenuItem value="">Aucun</MenuItem>
                {sites.map((s) => (
                  <MenuItem key={s.id} value={String(s.id)}>{s.name || s.code}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField fullWidth type="date" label="Date de début" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} InputLabelProps={{ shrink: true }} margin="normal" />
            <TextField fullWidth type="date" label="Date de fin" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} InputLabelProps={{ shrink: true }} margin="normal" />
            <FormControl fullWidth margin="normal">
              <InputLabel>Statut</InputLabel>
              <Select value={form.status} label="Statut" onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {STATUS_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
            <Box sx={{ mt: 2 }}>
              <Button
                type="button"
                variant="contained"
                startIcon={<Save />}
                disabled={saving}
                onClick={(e) => { e.preventDefault(); handleSubmit(e); }}
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
