import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import api from '../../services/api';
import { useActionPanel } from '../../context/ActionPanelContext';
import { useSnackbar } from '../../context/SnackbarContext';

export default function EquipmentCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', parentId: '' });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const { setContext } = useActionPanel();
  const snackbar = useSnackbar();

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    setContext({ type: 'list', entityType: 'equipment' });
    return () => setContext(null);
  }, [setContext]);

  useEffect(() => {
    if (!selectedId) return;
    const cat = categories.find((c) => c.id === selectedId);
    setContext(cat ? { type: 'list', entityType: 'equipment', selectedEntity: cat } : { type: 'list', entityType: 'equipment' });
  }, [selectedId, categories, setContext]);

  const loadCategories = async () => {
    try {
      const res = await api.get('/equipment/categories');
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: '', description: '', parentId: '' });
    setDialogOpen(true);
  };

  const openEdit = (cat, e) => {
    if (e) e.stopPropagation();
    setEditingId(cat.id);
    setForm({
      name: cat.name || '',
      description: cat.description || '',
      parentId: cat.parentId != null ? String(cat.parentId) : ''
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => setDialogOpen(false);

  const handleSave = async () => {
    if (!form.name.trim()) {
      snackbar.showError('Le nom est requis');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/equipment/categories/${editingId}`, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          parentId: form.parentId === '' ? null : parseInt(form.parentId, 10)
        });
        snackbar.showSuccess('Catégorie modifiée');
      } else {
        await api.post('/equipment/categories', {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          parentId: form.parentId === '' ? null : parseInt(form.parentId, 10)
        });
        snackbar.showSuccess('Catégorie ajoutée');
      }
      handleCloseDialog();
      loadCategories();
    } catch (err) {
      snackbar.showError(err.response?.data?.error || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteConfirm = (cat, e) => {
    if (e) e.stopPropagation();
    setDeleteConfirm(cat);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/equipment/categories/${deleteConfirm.id}`);
      snackbar.showSuccess('Catégorie supprimée');
      loadCategories();
      if (selectedId === deleteConfirm.id) setSelectedId(null);
      setDeleteConfirm(null);
    } catch (err) {
      snackbar.showError(err.response?.data?.error || 'Erreur');
    }
  };

  const parentOptions = categories.filter((c) => !editingId || c.id !== editingId);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Catégories d'équipements
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestion des catégories et sous-catégories
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openAdd}>
          Ajouter une catégorie
        </Button>
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : categories.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucune catégorie enregistrée. Cliquez sur « Ajouter une catégorie » pour en créer.
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nom</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Catégorie parente</TableCell>
                  <TableCell>Équipements</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow
                    key={cat.id}
                    selected={selectedId === cat.id}
                    onClick={() => setSelectedId(selectedId === cat.id ? null : cat.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{cat.name}</TableCell>
                    <TableCell>{cat.description || '-'}</TableCell>
                    <TableCell>{cat.parentName || '-'}</TableCell>
                    <TableCell>
                      <Chip label={cat.equipmentCount ?? 0} size="small" />
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <IconButton size="small" onClick={(e) => openEdit(cat, e)} title="Modifier">
                        <Edit />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={(e) => openDeleteConfirm(cat, e)} title="Supprimer" disabled={(cat.equipmentCount ?? 0) > 0}>
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nom"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            margin="normal"
            multiline
            rows={2}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Catégorie parente</InputLabel>
            <Select
              value={form.parentId}
              label="Catégorie parente"
              onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
            >
              <MenuItem value="">Aucune</MenuItem>
              {parentOptions.map((c) => (
                <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Supprimer la catégorie « {deleteConfirm?.name} » ? Les équipements qui y sont rattachés ne seront pas supprimés (leur catégorie sera vidée).
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Annuler</Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm}>Supprimer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
