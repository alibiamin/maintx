import React, { useEffect, useState } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableHead, TableRow,
  Button, CircularProgress, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Add, ContentCopy } from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';
import { useAuth } from '../../context/AuthContext';

export default function EquipmentModelsList() {
  const navigate = useNavigate();
  const [models, setModels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createFromModelOpen, setCreateFromModelOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', categoryId: '', manufacturer: '', model: '' });
  const [fromModelForm, setFromModelForm] = useState({ code: '', name: '' });
  const [saving, setSaving] = useState(false);
  const { user, can } = useAuth();
  const snackbar = useSnackbar();
  const canEdit = can('equipment_models', 'update');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/equipment-models'),
      api.get('/equipment/categories')
    ])
      .then(([r1, r2]) => {
        setModels(Array.isArray(r1.data) ? r1.data : []);
        setCategories(Array.isArray(r2.data) ? r2.data : []);
      })
      .catch(() => snackbar.showError('Erreur chargement'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm({ name: '', description: '', categoryId: '', manufacturer: '', model: '' });
    setDialogOpen(true);
  };

  const handleSaveModel = () => {
    if (!form.name.trim()) { snackbar.showError('Nom requis'); return; }
    setSaving(true);
    api.post('/equipment-models', form)
      .then(() => { snackbar.showSuccess('Modèle créé'); setDialogOpen(false); load(); })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setSaving(false));
  };

  const openCreateFromModel = (model) => {
    setSelectedModel(model);
    setFromModelForm({ code: '', name: model?.name || '' });
    setCreateFromModelOpen(true);
  };

  const handleCreateFromModel = () => {
    if (!selectedModel || !fromModelForm.code.trim() || !fromModelForm.name.trim()) {
      snackbar.showError('Code et nom requis');
      return;
    }
    setSaving(true);
    api.post('/equipment/from-model', { modelId: selectedModel.id, code: fromModelForm.code.trim(), name: fromModelForm.name.trim() })
      .then((r) => {
        snackbar.showSuccess('Équipement créé');
        setCreateFromModelOpen(false);
        navigate(`/app/equipment/${r.data.id}`);
      })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setSaving(false));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <h2 style={{ margin: 0 }}>Modèles d'équipements</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>Catalogue et templates pour créer rapidement des équipements</p>
        </Box>
        {canEdit && (
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Nouveau modèle</Button>
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
                <TableCell>Catégorie</TableCell>
                <TableCell>Constructeur / Modèle</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {models.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Typography color="text.secondary">Aucun modèle. Créez un modèle pour réutiliser fiche technique et catégorie.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                models.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.name}</TableCell>
                    <TableCell>{m.categoryName || '—'}</TableCell>
                    <TableCell>{[m.manufacturer, m.model].filter(Boolean).join(' / ') || '—'}</TableCell>
                    <TableCell align="right">
                      <Button size="small" startIcon={<ContentCopy />} onClick={() => openCreateFromModel(m)}>Créer un équipement</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouveau modèle</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Nom" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required margin="normal" />
          <TextField fullWidth label="Description" multiline rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} margin="normal" />
          <FormControl fullWidth margin="normal">
            <InputLabel>Catégorie</InputLabel>
            <Select value={form.categoryId} label="Catégorie" onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
              <MenuItem value="">Aucune</MenuItem>
              {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth label="Constructeur" value={form.manufacturer} onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))} margin="normal" />
          <TextField fullWidth label="Modèle" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} margin="normal" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSaveModel} disabled={saving}>Créer</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createFromModelOpen} onClose={() => setCreateFromModelOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Créer un équipement à partir du modèle « {selectedModel?.name} »</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Code" value={fromModelForm.code} onChange={(e) => setFromModelForm((f) => ({ ...f, code: e.target.value }))} required margin="normal" />
          <TextField fullWidth label="Nom" value={fromModelForm.name} onChange={(e) => setFromModelForm((f) => ({ ...f, name: e.target.value }))} required margin="normal" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateFromModelOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleCreateFromModel} disabled={saving || !fromModelForm.code.trim() || !fromModelForm.name.trim()}>Créer l'équipement</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
