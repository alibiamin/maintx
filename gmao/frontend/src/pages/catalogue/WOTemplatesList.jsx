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

export default function WOTemplatesList() {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', typeId: '', defaultPriority: 'medium', estimatedHours: 0 });
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const canEdit = ['administrateur', 'responsable_maintenance'].includes(user?.role);

  const load = () => {
    setLoading(true);
    api.get('/work-order-templates').then((r) => setList(Array.isArray(r.data) ? r.data : [])).catch(() => snackbar.showError('Erreur chargement')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditingId(null); setForm({ name: '', description: '', typeId: '', defaultPriority: 'medium', estimatedHours: 0 }); setDialogOpen(true); };
  const openEdit = (row) => { setEditingId(row.id); setForm({ name: row.name || '', description: row.description || '', typeId: row.type_id || '', defaultPriority: row.default_priority || 'medium', estimatedHours: row.estimated_hours || 0 }); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.name.trim()) { snackbar.showError('Nom requis'); return; }
    setSaving(true);
    const payload = { name: form.name, description: form.description, typeId: form.typeId || null, defaultPriority: form.defaultPriority, estimatedHours: form.estimatedHours };
    (editingId ? api.put(`/work-order-templates/${editingId}`, payload) : api.post('/work-order-templates', payload))
      .then(() => { snackbar.showSuccess(editingId ? 'Mis à jour' : 'Créé'); setDialogOpen(false); load(); })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (id) => {
    if (!window.confirm('Supprimer ce modèle ?')) return;
    api.delete(`/work-order-templates/${id}`).then(() => { snackbar.showSuccess('Supprimé'); load(); }).catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Typography variant="h5" fontWeight={700}>{t('item.wo_templates')}</Typography>
        {canEdit && <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Nouveau</Button>}
      </Box>
      <Card>
        {loading ? <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box> : (
          <Table>
            <TableHead><TableRow><TableCell>Nom</TableCell><TableCell>Type</TableCell><TableCell>Priorité</TableCell><TableCell>Heures estimées</TableCell>{canEdit && <TableCell align="right">Actions</TableCell>}</TableRow></TableHead>
            <TableBody>
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={canEdit ? 5 : 4} align="center"><Typography color="text.secondary">Aucun modèle d'OT</Typography></TableCell></TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.name}</TableCell><TableCell>{row.type_name || '—'}</TableCell><TableCell>{row.default_priority || '—'}</TableCell><TableCell>{row.estimated_hours ?? '—'}</TableCell>
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
        <DialogTitle>{editingId ? 'Modifier le modèle' : 'Nouveau modèle d\'OT'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Nom" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} margin="dense" />
          <TextField fullWidth label="Description" multiline value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} margin="dense" />
          <TextField fullWidth label="Priorité par défaut" select value={form.defaultPriority} onChange={(e) => setForm({ ...form, defaultPriority: e.target.value })} margin="dense" SelectProps={{ native: true }}>
            <option value="low">Basse</option><option value="medium">Moyenne</option><option value="high">Haute</option><option value="critical">Critique</option>
          </TextField>
          <TextField fullWidth type="number" label="Heures estimées" value={form.estimatedHours} onChange={(e) => setForm({ ...form, estimatedHours: parseFloat(e.target.value) || 0 })} margin="dense" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
