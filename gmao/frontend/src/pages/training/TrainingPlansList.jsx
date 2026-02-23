import React, { useEffect, useState } from 'react';
import { Box, Card, Table, TableBody, TableCell, TableHead, TableRow, Button, CircularProgress, Typography, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Add } from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';

const STATUS_LABELS = { planned: 'Planifié', in_progress: 'En cours', completed: 'Réalisé', cancelled: 'Annulé', overdue: 'En retard' };

export default function TrainingPlansList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ technicianId: '', trainingCatalogId: '', plannedDate: new Date().toISOString().slice(0, 10), status: 'planned', notes: '' });
  const snackbar = useSnackbar();

  const loadList = () => {
    setLoading(true);
    api.get('/training-plans').then((r) => setList(Array.isArray(r.data) ? r.data : [])).catch(() => snackbar.showError('Erreur chargement')).finally(() => setLoading(false));
  };

  useEffect(() => { loadList(); }, []);

  useEffect(() => {
    api.get('/technicians', { params: { limit: 500 } }).then((r) => {
      const data = r.data?.data ?? r.data;
      setTechnicians(Array.isArray(data) ? data : []);
    }).catch(() => setTechnicians([]));
    api.get('/training-catalog').then((r) => setCatalog(Array.isArray(r.data) ? r.data : [])).catch(() => setCatalog([]));
  }, []);

  const handleOpenDialog = () => {
    setForm({ technicianId: '', trainingCatalogId: '', plannedDate: new Date().toISOString().slice(0, 10), status: 'planned', notes: '' });
    setDialogOpen(true);
  };

  const handleCreate = () => {
    const technicianId = form.technicianId ? parseInt(form.technicianId, 10) : null;
    const trainingCatalogId = form.trainingCatalogId ? parseInt(form.trainingCatalogId, 10) : null;
    if (!technicianId || !trainingCatalogId) { snackbar.showError('Sélectionnez un technicien et une formation'); return; }
    setSaving(true);
    api.post('/training-plans', {
      technicianId,
      trainingCatalogId,
      plannedDate: form.plannedDate || undefined,
      status: form.status || 'planned',
      notes: form.notes || undefined
    }).then(() => { snackbar.showSuccess('Plan de formation créé'); setDialogOpen(false); loadList(); })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur'))
      .finally(() => setSaving(false));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>{t('item.training_plans')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={handleOpenDialog}>Planifier une formation</Button>
      </Box>
      <Card>
        {loading ? <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box> : (
          <Table>
            <TableHead><TableRow><TableCell>Technicien</TableCell><TableCell>Formation</TableCell><TableCell>Date prévue</TableCell><TableCell>Date réalisée</TableCell><TableCell>Statut</TableCell></TableRow></TableHead>
            <TableBody>
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center"><Typography color="text.secondary">Aucun plan de formation. Cliquez sur &quot;Planifier une formation&quot; pour en créer un.</Typography></TableCell></TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/app/technicians/${row.technician_id}`)}>
                    <TableCell>{row.technician_name}</TableCell><TableCell>{row.training_name || row.training_code}</TableCell><TableCell>{row.planned_date || '—'}</TableCell><TableCell>{row.completed_date || '—'}</TableCell><TableCell>{STATUS_LABELS[row.status] || row.status}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Planifier une formation</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" required sx={{ mt: 1, mb: 2 }}>
            <InputLabel>Technicien</InputLabel>
            <Select value={form.technicianId} label="Technicien" onChange={(e) => setForm(f => ({ ...f, technicianId: e.target.value }))}>
              {technicians.map((tech) => <MenuItem key={tech.id} value={tech.id}>{tech.first_name} {tech.last_name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small" required sx={{ mb: 2 }}>
            <InputLabel>Formation (catalogue)</InputLabel>
            <Select value={form.trainingCatalogId} label="Formation (catalogue)" onChange={(e) => setForm(f => ({ ...f, trainingCatalogId: e.target.value }))}>
              {catalog.map((c) => <MenuItem key={c.id} value={c.id}>{c.code || ''} - {c.name || 'Sans nom'}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField type="date" fullWidth size="small" label="Date prévue" value={form.plannedDate} onChange={(e) => setForm(f => ({ ...f, plannedDate: e.target.value }))} InputLabelProps={{ shrink: true }} sx={{ mb: 2 }} />
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Statut</InputLabel>
            <Select value={form.status} label="Statut" onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth size="small" label="Notes" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} multiline rows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>{saving ? 'Création...' : 'Créer'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
