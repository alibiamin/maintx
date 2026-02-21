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

export default function ProceduresList() {
  const [list, setList] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', steps: '', safetyNotes: '', equipmentModelId: '' });
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const canEdit = ['administrateur', 'responsable_maintenance'].includes(user?.role);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/procedures'), api.get('/equipment-models').catch(() => ({ data: [] }))])
      .then(([r1, r2]) => {
        setList(Array.isArray(r1.data) ? r1.data : []);
        setModels(Array.isArray(r2.data) ? r2.data : []);
      })
      .catch(() => snackbar.showError('Erreur chargement'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', description: '', steps: '', safetyNotes: '', equipmentModelId: '' });
    setDialogOpen(true);
  };

  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({
      name: p.name || '',
      description: p.description || '',
      steps: p.steps || '',
      safetyNotes: p.safetyNotes || '',
      equipmentModelId: p.equipmentModelId ?? ''
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { snackbar.showError('Nom requis'); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description || null,
      steps: form.steps || null,
      safetyNotes: form.safetyNotes || null,
      equipmentModelId: form.equipmentModelId || null
    };
    if (editingId) {
      api.put(`/procedures/${editingId}`, payload)
        .then(() => { snackbar.showSuccess('Procédure mise à jour'); setDialogOpen(false); load(); })
        .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
        .finally(() => setSaving(false));
    } else {
      api.post('/procedures', payload)
        .then(() => { snackbar.showSuccess('Procédure créée'); setDialogOpen(false); load(); })
        .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
        .finally(() => setSaving(false));
    }
  };

  const handleDelete = (id) => {
    if (!window.confirm('Supprimer cette procédure ?')) return;
    api.delete(`/procedures/${id}`)
      .then(() => { snackbar.showSuccess('Procédure supprimée'); load(); })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <h2 style={{ margin: 0 }}>Procédures et modes opératoires</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>Documents structurés (étapes, consignes de sécurité) liés aux plans ou aux modèles d'équipement</p>
        </Box>
        {canEdit && (
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Nouvelle procédure</Button>
        )}
      </Box>

      <Card>
        {loading ? (
          <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nom</TableCell>
                <TableCell>Modèle d'équipement</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center">
                    <Typography color="text.secondary">Aucune procédure. Créez-en une pour lier des étapes et consignes aux plans de maintenance.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                list.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.equipmentModelName || '—'}</TableCell>
                    <TableCell align="right">
                      {canEdit && (
                        <>
                          <Button size="small" onClick={() => openEdit(p)}>Modifier</Button>
                          <Button size="small" color="error" onClick={() => handleDelete(p.id)}>Supprimer</Button>
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
        <DialogTitle>{editingId ? 'Modifier la procédure' : 'Nouvelle procédure'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Nom" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required margin="normal" />
          <TextField fullWidth label="Description" multiline rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} margin="normal" />
          <TextField fullWidth label="Étapes (texte libre)" multiline rows={4} value={form.steps} onChange={(e) => setForm((f) => ({ ...f, steps: e.target.value }))} margin="normal" placeholder="1. ... 2. ..." />
          <TextField fullWidth label="Consignes de sécurité" multiline rows={2} value={form.safetyNotes} onChange={(e) => setForm((f) => ({ ...f, safetyNotes: e.target.value }))} margin="normal" />
          <FormControl fullWidth margin="normal">
            <InputLabel>Modèle d'équipement</InputLabel>
            <Select value={form.equipmentModelId} label="Modèle d'équipement" onChange={(e) => setForm((f) => ({ ...f, equipmentModelId: e.target.value }))}>
              <MenuItem value="">Aucun</MenuItem>
              {models.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{editingId ? 'Enregistrer' : 'Créer'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
