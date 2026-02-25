import React, { useEffect, useState } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableHead, TableRow,
  Button, CircularProgress, Typography, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';
import { useAuth } from '../../context/AuthContext';

export default function StockLocationsList() {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', siteId: '' });
  const [saving, setSaving] = useState(false);
  const { user, can } = useAuth();
  const snackbar = useSnackbar();
  const canEdit = can('stock_locations', 'update');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/stock-locations').then((r) => setList(Array.isArray(r.data) ? r.data : [])),
      api.get('/sites').then((r) => setSites(Array.isArray(r.data) ? r.data : [])).catch(() => {})
    ]).catch(() => snackbar.showError('Erreur chargement')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditingId(null); setForm({ code: '', name: '', description: '', siteId: '' }); setDialogOpen(true); };
  const openEdit = (row) => { setEditingId(row.id); setForm({ code: row.code || '', name: row.name || '', description: row.description || '', siteId: row.site_id || '' }); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.name.trim()) { snackbar.showError('Nom requis'); return; }
    setSaving(true);
    const payload = { code: form.code, name: form.name, description: form.description, siteId: form.siteId || null };
    (editingId ? api.put(`/stock-locations/${editingId}`, payload) : api.post('/stock-locations', payload))
      .then(() => { snackbar.showSuccess(editingId ? 'Mis à jour' : 'Créé'); setDialogOpen(false); load(); })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (id) => {
    if (!window.confirm('Supprimer cet emplacement ?')) return;
    api.delete(`/stock-locations/${id}`).then(() => { snackbar.showSuccess('Supprimé'); load(); }).catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Typography variant="h5" fontWeight={700}>{t('item.stock_locations')}</Typography>
        {canEdit && <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Nouveau</Button>}
      </Box>
      <Card>
        {loading ? <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box> : (
          <Table>
            <TableHead><TableRow><TableCell>Code</TableCell><TableCell>Nom</TableCell><TableCell>Site</TableCell><TableCell>Description</TableCell>{canEdit && <TableCell align="right">Actions</TableCell>}</TableRow></TableHead>
            <TableBody>
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={canEdit ? 5 : 4} align="center"><Typography color="text.secondary">Aucun emplacement</Typography></TableCell></TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.code}</TableCell><TableCell>{row.name}</TableCell><TableCell>{row.site_name || '—'}</TableCell><TableCell>{row.description || '—'}</TableCell>
                    {canEdit && (
                      <TableCell align="right">
                        <Button size="small" onClick={() => openEdit(row)}>Modifier</Button>
                        <Button size="small" color="error" onClick={() => handleDelete(row.id)}>Supprimer</Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Modifier l\'emplacement' : 'Nouvel emplacement'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} margin="dense" />
          <TextField fullWidth label="Nom" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} margin="dense" />
          <FormControl fullWidth margin="dense">
            <InputLabel>Site</InputLabel>
            <Select value={form.siteId} label="Site" onChange={(e) => setForm({ ...form, siteId: e.target.value })}>
              <MenuItem value="">—</MenuItem>
              {sites.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth label="Description" multiline value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} margin="dense" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
