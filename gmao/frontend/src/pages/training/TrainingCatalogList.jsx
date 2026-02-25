import React, { useEffect, useState } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableHead, TableRow,
  Button, CircularProgress, Typography, Dialog, DialogTitle, DialogContent, DialogActions, TextField
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';
import { useAuth } from '../../context/AuthContext';

export default function TrainingCatalogList() {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', durationHours: 0, validityMonths: '', isMandatory: false });
  const [saving, setSaving] = useState(false);
  const { user, can } = useAuth();
  const snackbar = useSnackbar();
  const canEdit = can('training_catalog', 'update');

  const load = () => {
    setLoading(true);
    api.get('/training-catalog').then((r) => setList(Array.isArray(r.data) ? r.data : [])).catch(() => snackbar.showError('Erreur chargement')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditingId(null); setForm({ code: '', name: '', description: '', durationHours: 0, validityMonths: '', isMandatory: false }); setDialogOpen(true); };
  const openEdit = (row) => { setEditingId(row.id); setForm({ code: row.code || '', name: row.name || '', description: row.description || '', durationHours: row.duration_hours || 0, validityMonths: row.validity_months ?? '', isMandatory: !!row.is_mandatory }); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.name.trim()) { snackbar.showError('Nom requis'); return; }
    setSaving(true);
    const payload = { code: form.code, name: form.name, description: form.description, durationHours: form.durationHours, validityMonths: form.validityMonths || null, isMandatory: form.isMandatory };
    (editingId ? api.put(`/training-catalog/${editingId}`, payload) : api.post('/training-catalog', payload))
      .then(() => { snackbar.showSuccess(editingId ? 'Mis à jour' : 'Créé'); setDialogOpen(false); load(); })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (id) => {
    if (!window.confirm('Supprimer cette formation du catalogue ?')) return;
    api.delete(`/training-catalog/${id}`).then(() => { snackbar.showSuccess('Supprimé'); load(); }).catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Typography variant="h5" fontWeight={700}>{t('item.training_catalog')}</Typography>
        {canEdit && <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Nouveau</Button>}
      </Box>
      <Card>
        {loading ? <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box> : (
          <Table>
            <TableHead><TableRow><TableCell>Code</TableCell><TableCell>Nom</TableCell><TableCell>Durée (h)</TableCell><TableCell>Validité (mois)</TableCell><TableCell>Obligatoire</TableCell>{canEdit && <TableCell align="right">Actions</TableCell>}</TableRow></TableHead>
            <TableBody>
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={canEdit ? 6 : 5} align="center"><Typography color="text.secondary">Aucune formation au catalogue</Typography></TableCell></TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.code}</TableCell><TableCell>{row.name}</TableCell><TableCell>{row.duration_hours ?? '—'}</TableCell><TableCell>{row.validity_months ?? '—'}</TableCell><TableCell>{row.is_mandatory ? 'Oui' : 'Non'}</TableCell>
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
        <DialogTitle>{editingId ? 'Modifier la formation' : 'Nouvelle formation'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} margin="dense" />
          <TextField fullWidth label="Nom" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} margin="dense" />
          <TextField fullWidth label="Description" multiline value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} margin="dense" />
          <TextField fullWidth type="number" label="Durée (heures)" value={form.durationHours} onChange={(e) => setForm({ ...form, durationHours: parseFloat(e.target.value) || 0 })} margin="dense" />
          <TextField fullWidth type="number" label="Validité (mois)" value={form.validityMonths} onChange={(e) => setForm({ ...form, validityMonths: e.target.value })} margin="dense" placeholder="Optionnel" />
          <TextField fullWidth select SelectProps={{ native: true }} label="Obligatoire" value={form.isMandatory ? '1' : '0'} onChange={(e) => setForm({ ...form, isMandatory: e.target.value === '1' })} margin="dense">
            <option value="0">Non</option><option value="1">Oui</option>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
