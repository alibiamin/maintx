import React, { useEffect, useState } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableHead, TableRow,
  Button, CircularProgress, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { Add } from '@mui/icons-material';
import api from '../services/api';
import { useSnackbar } from '../context/SnackbarContext';
import { useAuth } from '../context/AuthContext';

const CATEGORY_SUGGESTIONS = ['Cause', 'Mode', 'Remède', 'Mécanique', 'Électrique', 'Hydraulique', 'Thermique', 'Général'];

export default function FailureCodesList() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', category: '' });
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const canEdit = ['administrateur', 'responsable_maintenance'].includes(user?.role);

  const load = () => {
    setLoading(true);
    api.get('/failure-codes')
      .then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch(() => snackbar.showError('Erreur chargement'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filteredList = categoryFilter ? list.filter((fc) => (fc.category || '') === categoryFilter) : list;
  const categories = [...new Set(list.map((fc) => fc.category || '').filter(Boolean))].sort();

  const openCreate = () => {
    setEditingId(null);
    setForm({ code: '', name: '', description: '', category: '' });
    setDialogOpen(true);
  };

  const openEdit = (fc) => {
    setEditingId(fc.id);
    setForm({ code: fc.code || '', name: fc.name || '', description: fc.description || '', category: fc.category || '' });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { snackbar.showError('Nom requis'); return; }
    setSaving(true);
    if (editingId) {
      api.put(`/failure-codes/${editingId}`, form)
        .then(() => { snackbar.showSuccess('Code mis à jour'); setDialogOpen(false); load(); })
        .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
        .finally(() => setSaving(false));
    } else {
      api.post('/failure-codes', form)
        .then(() => { snackbar.showSuccess('Code créé'); setDialogOpen(false); load(); })
        .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
        .finally(() => setSaving(false));
    }
  };

  const handleDelete = (id) => {
    if (!window.confirm('Supprimer ce code défaut ?')) return;
    api.delete(`/failure-codes/${id}`)
      .then(() => { snackbar.showSuccess('Code supprimé'); load(); })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <h2 style={{ margin: 0 }}>Thésaurus défaillances</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>Codes défaut / causes de panne pour l'analyse FMECA et la déclaration de pannes</p>
        </Box>
        {canEdit && (
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Nouveau code</Button>
        )}
      </Box>

      <Card>
        <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Catégorie</InputLabel>
            <Select value={categoryFilter} label="Catégorie" onChange={(e) => setCategoryFilter(e.target.value)}>
              <MenuItem value="">Toutes</MenuItem>
              {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        {loading ? (
          <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Nom</TableCell>
                <TableCell>Catégorie</TableCell>
                <TableCell>Description</TableCell>
                {canEdit && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 5 : 4} align="center">
                    <Typography color="text.secondary">Aucun code défaut. Créez-en pour analyser les pannes (cause, mode, remède).</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredList.map((fc) => (
                  <TableRow key={fc.id}>
                    <TableCell>{fc.code}</TableCell>
                    <TableCell>{fc.name}</TableCell>
                    <TableCell>{fc.category || '—'}</TableCell>
                    <TableCell>{fc.description ? fc.description.slice(0, 60) + (fc.description.length > 60 ? '…' : '') : '—'}</TableCell>
                    {canEdit && (
                      <TableCell align="right">
                        <Button size="small" onClick={() => openEdit(fc)}>Modifier</Button>
                        <Button size="small" color="error" onClick={() => handleDelete(fc.id)}>Supprimer</Button>
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
        <DialogTitle>{editingId ? 'Modifier le code défaut' : 'Nouveau code défaut'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} margin="normal" placeholder="Ex: MEC-01 (vide = auto)" />
          <TextField fullWidth label="Nom" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required margin="normal" />
          <FormControl fullWidth margin="normal">
            <InputLabel>Catégorie</InputLabel>
            <Select value={form.category} label="Catégorie" onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} onBlur={() => {}}>
              <MenuItem value="">Aucune</MenuItem>
              {CATEGORY_SUGGESTIONS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              {categories.filter((c) => !CATEGORY_SUGGESTIONS.includes(c)).map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth label="Description" multiline rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} margin="normal" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name.trim()}>{editingId ? 'Enregistrer' : 'Créer'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
