import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  CircularProgress,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';
import { useAuth } from '../../context/AuthContext';

export default function PartFamiliesList() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [families, setFamilies] = useState([]);
  const [subFamilies, setSubFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [familyDialogOpen, setFamilyDialogOpen] = useState(false);
  const [subFamilyDialogOpen, setSubFamilyDialogOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingFamilyId, setEditingFamilyId] = useState(null);
  const [editingSubFamilyId, setEditingSubFamilyId] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ code: '', name: '', description: '' });
  const [familyForm, setFamilyForm] = useState({ code: '', name: '', description: '', categoryId: '' });
  const [subFamilyForm, setSubFamilyForm] = useState({ partFamilyId: '', position: 1, code: '', name: '' });
  const [saving, setSaving] = useState(false);
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterFamilyId, setFilterFamilyId] = useState('');
  const { user, can } = useAuth();
  const snackbar = useSnackbar();
  const canEdit = can('part_families', 'update');

  const familiesFilteredByCategory = filterCategoryId ? families.filter((f) => String(f.category_id) === String(filterCategoryId)) : families;
  const subFamiliesFilteredByFamily = filterFamilyId ? subFamilies.filter((s) => String(s.part_family_id) === String(filterFamilyId)) : subFamilies;

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/part-categories').then((r) => setCategories(Array.isArray(r.data) ? r.data : [])).catch(() => setCategories([])),
      api.get('/part-families').then((r) => setFamilies(Array.isArray(r.data) ? r.data : [])).catch(() => setFamilies([])),
      api.get('/part-sub-families').then((r) => setSubFamilies(Array.isArray(r.data) ? r.data : [])).catch(() => setSubFamilies([]))
    ]).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCategoryCreate = () => { setEditingCategoryId(null); setCategoryForm({ code: '', name: '', description: '' }); setCategoryDialogOpen(true); };
  const openCategoryEdit = (row) => { setEditingCategoryId(row.id); setCategoryForm({ code: row.code || '', name: row.name || '', description: row.description || '' }); setCategoryDialogOpen(true); };
  const openFamilyCreate = () => { setEditingFamilyId(null); setFamilyForm({ code: '', name: '', description: '', categoryId: filterCategoryId || '' }); setFamilyDialogOpen(true); };
  const openFamilyEdit = (row) => {
    setEditingFamilyId(row.id);
    setFamilyForm({ code: row.code || '', name: row.name || '', description: row.description || '', categoryId: row.category_id ?? '' });
    setFamilyDialogOpen(true);
  };
  const openSubFamilyCreate = () => { setEditingSubFamilyId(null); setSubFamilyForm({ partFamilyId: filterFamilyId || '', position: 1, code: '', name: '' }); setSubFamilyDialogOpen(true); };
  const openSubFamilyEdit = (row) => {
    setEditingSubFamilyId(row.id);
    setSubFamilyForm({ partFamilyId: row.part_family_id ?? '', position: row.position ?? 1, code: row.code || '', name: row.name || '' });
    setSubFamilyDialogOpen(true);
  };

  const handleSaveCategory = () => {
    if (!categoryForm.name.trim()) { snackbar.showError('Nom requis'); return; }
    setSaving(true);
    const payload = { code: categoryForm.code || undefined, name: categoryForm.name.trim(), description: categoryForm.description || undefined };
    (editingCategoryId ? api.put(`/part-categories/${editingCategoryId}`, payload) : api.post('/part-categories', payload))
      .then(() => { snackbar.showSuccess(editingCategoryId ? 'Catégorie mise à jour' : 'Catégorie créée'); setCategoryDialogOpen(false); load(); })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setSaving(false));
  };

  const handleSaveFamily = () => {
    if (!familyForm.name.trim()) { snackbar.showError('Nom requis'); return; }
    setSaving(true);
    const payload = { code: familyForm.code || undefined, name: familyForm.name.trim(), description: familyForm.description || undefined, categoryId: familyForm.categoryId || undefined };
    (editingFamilyId ? api.put(`/part-families/${editingFamilyId}`, payload) : api.post('/part-families', payload))
      .then(() => { snackbar.showSuccess(editingFamilyId ? 'Famille mise à jour' : 'Famille créée'); setFamilyDialogOpen(false); load(); })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setSaving(false));
  };

  const handleSaveSubFamily = () => {
    if (!subFamilyForm.name.trim()) { snackbar.showError('Nom requis'); return; }
    if (!subFamilyForm.partFamilyId) { snackbar.showError('Famille requise'); return; }
    setSaving(true);
    const payload = { partFamilyId: parseInt(subFamilyForm.partFamilyId, 10), position: subFamilyForm.position, code: subFamilyForm.code || undefined, name: subFamilyForm.name.trim() };
    if (editingSubFamilyId) {
      api.put(`/part-sub-families/${editingSubFamilyId}`, payload)
        .then(() => { snackbar.showSuccess('Sous-famille mise à jour'); setSubFamilyDialogOpen(false); load(); })
        .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
        .finally(() => setSaving(false));
    } else {
      api.post('/part-sub-families', payload)
        .then(() => { snackbar.showSuccess('Sous-famille créée'); setSubFamilyDialogOpen(false); load(); })
        .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
        .finally(() => setSaving(false));
    }
  };

  const handleDeleteCategory = (id) => {
    if (!window.confirm('Supprimer cette catégorie ?')) return;
    api.delete(`/part-categories/${id}`).then(() => { snackbar.showSuccess('Catégorie supprimée'); load(); }).catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'));
  };

  const handleDeleteFamily = (id) => {
    if (!window.confirm('Supprimer cette famille ? Les sous-familles rattachées seront supprimées.')) return;
    api.delete(`/part-families/${id}`).then(() => { snackbar.showSuccess('Famille supprimée'); load(); }).catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'));
  };

  const handleDeleteSubFamily = (id) => {
    if (!window.confirm('Supprimer cette sous-famille ?')) return;
    api.delete(`/part-sub-families/${id}`).then(() => { snackbar.showSuccess('Sous-famille supprimée'); load(); }).catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'));
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>{t('item.part_families')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Paramétrage des catégories, familles et sous-familles (chaque niveau dans une grille séparée). Ces valeurs seront proposées lors de la saisie du stock des pièces.
      </Typography>

      {loading ? (
        <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>
      ) : (
        <Grid container spacing={3}>
          {/* Grille 1 : Catégories */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} sx={{ mb: 2 }}>
                  <Typography variant="h6" fontWeight={600}>Catégories</Typography>
                  {canEdit && <Button variant="outlined" size="small" startIcon={<Add />} onClick={openCategoryCreate}>Nouvelle catégorie</Button>}
                </Box>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Code</TableCell>
                      <TableCell>Nom</TableCell>
                      <TableCell>Description</TableCell>
                      {canEdit && <TableCell align="right">Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {categories.length === 0 ? (
                      <TableRow><TableCell colSpan={canEdit ? 4 : 3} align="center"><Typography color="text.secondary">Aucune catégorie.</Typography></TableCell></TableRow>
                    ) : (
                      categories.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.code}</TableCell>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>{row.description || '—'}</TableCell>
                          {canEdit && (
                            <TableCell align="right">
                              <Button size="small" onClick={() => openCategoryEdit(row)}>Modifier</Button>
                              <Button size="small" color="error" onClick={() => handleDeleteCategory(row.id)}>Supprimer</Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>

          {/* Grille 2 : Familles (filtrées par catégorie) */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} sx={{ mb: 2 }}>
                  <Typography variant="h6" fontWeight={600}>Familles</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <FormControl size="small" sx={{ minWidth: 220 }}>
                      <InputLabel>Filtrer par catégorie</InputLabel>
                      <Select
                        value={filterCategoryId}
                        label="Filtrer par catégorie"
                        onChange={(e) => {
                          const newCatId = e.target.value;
                          setFilterCategoryId(newCatId);
                          if (newCatId && filterFamilyId) {
                            const family = families.find((f) => String(f.id) === String(filterFamilyId));
                            if (family && String(family.category_id) !== String(newCatId)) setFilterFamilyId('');
                          }
                        }}
                      >
                        <MenuItem value="">Toutes les catégories</MenuItem>
                        {categories.map((c) => (<MenuItem key={c.id} value={c.id}>{c.code} – {c.name}</MenuItem>))}
                      </Select>
                    </FormControl>
                    {canEdit && <Button variant="outlined" size="small" startIcon={<Add />} onClick={openFamilyCreate}>Nouvelle famille</Button>}
                  </Box>
                </Box>
                <Table size="small">
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
                    {familiesFilteredByCategory.length === 0 ? (
                      <TableRow><TableCell colSpan={canEdit ? 5 : 4} align="center"><Typography color="text.secondary">{filterCategoryId ? 'Aucune famille dans cette catégorie.' : 'Aucune famille.'}</Typography></TableCell></TableRow>
                    ) : (
                      familiesFilteredByCategory.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.code}</TableCell>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>{row.category_name || row.category_code || '—'}</TableCell>
                          <TableCell>{row.description || '—'}</TableCell>
                          {canEdit && (
                            <TableCell align="right">
                              <Button size="small" onClick={() => openFamilyEdit(row)}>Modifier</Button>
                              <Button size="small" color="error" onClick={() => handleDeleteFamily(row.id)}>Supprimer</Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>

          {/* Grille 3 : Sous-familles (filtrées par famille) */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} sx={{ mb: 2 }}>
                  <Typography variant="h6" fontWeight={600}>Sous-familles</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <FormControl size="small" sx={{ minWidth: 220 }}>
                      <InputLabel>Filtrer par famille</InputLabel>
                      <Select value={filterFamilyId} label="Filtrer par famille" onChange={(e) => setFilterFamilyId(e.target.value)}>
                        <MenuItem value="">Toutes les familles</MenuItem>
                        {familiesFilteredByCategory.map((f) => (<MenuItem key={f.id} value={f.id}>{f.code} – {f.name}</MenuItem>))}
                      </Select>
                    </FormControl>
                    {canEdit && <Button variant="outlined" size="small" startIcon={<Add />} onClick={openSubFamilyCreate}>Nouvelle sous-famille</Button>}
                  </Box>
                </Box>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Famille</TableCell>
                      <TableCell>Position</TableCell>
                      <TableCell>Code</TableCell>
                      <TableCell>Nom</TableCell>
                      {canEdit && <TableCell align="right">Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {subFamiliesFilteredByFamily.length === 0 ? (
                      <TableRow><TableCell colSpan={canEdit ? 5 : 4} align="center"><Typography color="text.secondary">{filterFamilyId ? 'Aucune sous-famille pour cette famille.' : 'Aucune sous-famille. Choisissez une famille et une position (1 à 5).'}</Typography></TableCell></TableRow>
                    ) : (
                      subFamiliesFilteredByFamily.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.family_name || row.family_code || '—'}</TableCell>
                          <TableCell>{row.position}</TableCell>
                          <TableCell>{row.code}</TableCell>
                          <TableCell>{row.name}</TableCell>
                          {canEdit && (
                            <TableCell align="right">
                              <Button size="small" onClick={() => openSubFamilyEdit(row)}>Modifier</Button>
                              <Button size="small" color="error" onClick={() => handleDeleteSubFamily(row.id)}>Supprimer</Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCategoryId ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Code" value={categoryForm.code} onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })} margin="dense" />
          <TextField fullWidth label="Nom" required value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} margin="dense" />
          <TextField fullWidth label="Description" multiline value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} margin="dense" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSaveCategory} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={familyDialogOpen} onClose={() => setFamilyDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingFamilyId ? 'Modifier la famille' : 'Nouvelle famille'}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1, mb: 1 }}>
            <InputLabel>Catégorie</InputLabel>
            <Select value={familyForm.categoryId ?? ''} label="Catégorie" onChange={(e) => setFamilyForm({ ...familyForm, categoryId: e.target.value })}>
              <MenuItem value="">— Aucune —</MenuItem>
              {categories.map((c) => (<MenuItem key={c.id} value={c.id}>{c.code} – {c.name}</MenuItem>))}
            </Select>
          </FormControl>
          <TextField fullWidth label="Code" value={familyForm.code} onChange={(e) => setFamilyForm({ ...familyForm, code: e.target.value })} margin="dense" />
          <TextField fullWidth label="Nom" required value={familyForm.name} onChange={(e) => setFamilyForm({ ...familyForm, name: e.target.value })} margin="dense" />
          <TextField fullWidth label="Description" multiline value={familyForm.description} onChange={(e) => setFamilyForm({ ...familyForm, description: e.target.value })} margin="dense" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFamilyDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSaveFamily} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={subFamilyDialogOpen} onClose={() => setSubFamilyDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingSubFamilyId ? 'Modifier la sous-famille' : 'Nouvelle sous-famille'}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1, mb: 1 }}>
            <InputLabel>Famille</InputLabel>
            <Select value={subFamilyForm.partFamilyId ?? ''} label="Famille" onChange={(e) => setSubFamilyForm({ ...subFamilyForm, partFamilyId: e.target.value })} disabled={!!editingSubFamilyId}>
              <MenuItem value="">— Choisir —</MenuItem>
              {(filterCategoryId ? familiesFilteredByCategory : families).map((f) => (<MenuItem key={f.id} value={f.id}>{f.code} – {f.name}</MenuItem>))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Position (1 à 5)</InputLabel>
            <Select value={subFamilyForm.position ?? 1} label="Position (1 à 5)" onChange={(e) => setSubFamilyForm({ ...subFamilyForm, position: Number(e.target.value) })} disabled={!!editingSubFamilyId}>
              {[1, 2, 3, 4, 5].map((p) => (<MenuItem key={p} value={p}>{p}</MenuItem>))}
            </Select>
          </FormControl>
          <TextField fullWidth label="Code" value={subFamilyForm.code} onChange={(e) => setSubFamilyForm({ ...subFamilyForm, code: e.target.value })} margin="dense" />
          <TextField fullWidth label="Nom" required value={subFamilyForm.name} onChange={(e) => setSubFamilyForm({ ...subFamilyForm, name: e.target.value })} margin="dense" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubFamilyDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSaveSubFamily} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
