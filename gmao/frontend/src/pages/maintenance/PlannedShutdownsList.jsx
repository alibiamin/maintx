import React, { useEffect, useState } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableHead, TableRow, Button, CircularProgress, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem,
  Chip, IconButton
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Add, Edit, Delete } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';
import { useAuth } from '../../context/AuthContext';

const STATUS_LABELS = { planned: 'Planifié', confirmed: 'Confirmé', in_progress: 'En cours', completed: 'Terminé', cancelled: 'Annulé' };
const IMPACT_LABELS = { low: 'Faible', medium: 'Moyen', high: 'Élevé', critical: 'Critique' };

export default function PlannedShutdownsList() {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '', startDate: '', endDate: '', siteId: '', durationHours: '', reason: '', impactLevel: 'medium', description: ''
  });
  const snackbar = useSnackbar();
  const { can } = useAuth();

  const loadList = () => {
    setLoading(true);
    api.get('/planned-shutdowns').then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch(() => snackbar.showError('Erreur chargement')).finally(() => setLoading(false));
  };

  useEffect(() => { loadList(); }, []);
  useEffect(() => {
    api.get('/sites').then((r) => setSites(Array.isArray(r.data) ? r.data : [])).catch(() => setSites([]));
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({ name: '', startDate: '', endDate: '', siteId: '', durationHours: '', reason: '', impactLevel: 'medium', description: '' });
    setDialogOpen(true);
  };

  const handleOpenEdit = (row) => {
    setEditingId(row.id);
    setForm({
      name: row.name || '',
      startDate: (row.startDate || '').slice(0, 10),
      endDate: (row.endDate || '').slice(0, 10),
      siteId: row.siteId || '',
      durationHours: row.durationHours ?? '',
      reason: row.reason || '',
      impactLevel: row.impactLevel || 'medium',
      description: row.description || ''
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name || !form.startDate || !form.endDate) {
      snackbar.showError('Nom, date début et date fin requis');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
      siteId: form.siteId ? parseInt(form.siteId, 10) : undefined,
      durationHours: form.durationHours ? parseFloat(form.durationHours) : undefined,
      reason: form.reason || undefined,
      impactLevel: form.impactLevel,
      description: form.description || undefined
    };
    const promise = editingId
      ? api.put(`/planned-shutdowns/${editingId}`, payload)
      : api.post('/planned-shutdowns', payload);
    promise
      .then(() => {
        snackbar.showSuccess(editingId ? 'Arrêt planifié mis à jour' : 'Arrêt planifié créé');
        setDialogOpen(false);
        loadList();
      })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (id) => {
    if (!window.confirm('Supprimer cet arrêt planifié ?')) return;
    api.delete(`/planned-shutdowns/${id}`).then(() => { snackbar.showSuccess('Supprimé'); loadList(); })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur'));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>{t('item.planned_shutdowns', 'Arrêts planifiés')}</Typography>
        {can('planned_shutdowns', 'create') && (
          <Button variant="contained" startIcon={<Add />} onClick={handleOpenCreate}>
            Nouvel arrêt planifié
          </Button>
        )}
      </Box>
      <Card>
        {loading ? (
          <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>N°</TableCell>
                <TableCell>Nom</TableCell>
                <TableCell>Site</TableCell>
                <TableCell>Début</TableCell>
                <TableCell>Fin</TableCell>
                <TableCell>Impact</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>OT liés</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography color="text.secondary">Aucun arrêt planifié. Créez-en un pour gérer les arrêts de production.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.shutdownNumber}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.siteName || '—'}</TableCell>
                    <TableCell>{(row.startDate || '').slice(0, 10)}</TableCell>
                    <TableCell>{(row.endDate || '').slice(0, 10)}</TableCell>
                    <TableCell><Chip size="small" label={IMPACT_LABELS[row.impactLevel] || row.impactLevel} /></TableCell>
                    <TableCell><Chip size="small" color={row.status === 'completed' ? 'success' : row.status === 'cancelled' ? 'default' : 'primary'} label={STATUS_LABELS[row.status] || row.status} /></TableCell>
                    <TableCell>
                      {(row.workOrders || []).length > 0
                        ? row.workOrders.map((wo) => (
                            <Box key={wo.id} component={Link} to={`/app/work-orders/${wo.id}`} sx={{ display: 'block', color: 'primary.main', textDecoration: 'none', fontSize: '0.875rem' }}>{wo.number}</Box>
                          ))
                        : '—'}
                    </TableCell>
                    <TableCell align="right">
                      {can('planned_shutdowns', 'update') && (
                        <>
                          <IconButton size="small" onClick={() => handleOpenEdit(row)} title="Modifier"><Edit fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => handleDelete(row.id)} title="Supprimer" color="error"><Delete fontSize="small" /></IconButton>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Modifier l\'arrêt planifié' : 'Nouvel arrêt planifié'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth size="small" label="Nom" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required sx={{ mt: 1, mb: 2 }} />
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField type="date" size="small" label="Date début" value={form.startDate} onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth required />
            <TextField type="date" size="small" label="Date fin" value={form.endDate} onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth required />
          </Box>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Site</InputLabel>
            <Select value={form.siteId} label="Site" onChange={(e) => setForm(f => ({ ...f, siteId: e.target.value }))}>
              <MenuItem value="">— Aucun —</MenuItem>
              {sites.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth size="small" type="number" label="Durée (heures)" value={form.durationHours} onChange={(e) => setForm(f => ({ ...f, durationHours: e.target.value }))} sx={{ mb: 2 }} />
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Impact</InputLabel>
            <Select value={form.impactLevel} label="Impact" onChange={(e) => setForm(f => ({ ...f, impactLevel: e.target.value }))}>
              {Object.entries(IMPACT_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth size="small" label="Raison" value={form.reason} onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))} sx={{ mb: 2 }} />
          <TextField fullWidth size="small" label="Description" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} multiline rows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
