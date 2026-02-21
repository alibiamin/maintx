import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton
} from '@mui/material';
import { ArrowBack, Add, Edit, Delete } from '@mui/icons-material';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSnackbar } from '../../context/SnackbarContext';

export default function CompetenciesPage() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const canEdit = ['administrateur', 'responsable_maintenance'].includes(user?.role);

  const load = () => {
    api.get('/competencies').then(r => setList(r.data || [])).catch(() => setList([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleOpen = (row = null) => {
    setEditing(row?.id ?? null);
    setForm({ code: row?.code ?? '', name: row?.name ?? '', description: row?.description ?? '' });
    setOpen(true);
  };

  const handleClose = () => { setOpen(false); setEditing(null); setForm({ code: '', name: '', description: '' }); };

  const handleSave = () => {
    if (!form.code?.trim() || !form.name?.trim()) { snackbar.showError('Code et nom requis'); return; }
    setSaving(true);
    const promise = editing
      ? api.put(`/competencies/${editing}`, form)
      : api.post('/competencies', form);
    promise
      .then(() => { load(); handleClose(); snackbar.showSuccess(editing ? 'Compétence modifiée' : 'Compétence créée'); })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (id) => {
    if (!window.confirm('Supprimer cette compétence ?')) return;
    api.delete(`/competencies/${id}`).then(() => { load(); snackbar.showSuccess('Compétence supprimée'); }).catch(() => snackbar.showError('Erreur'));
  };

  if (loading) return <Box p={4}><CircularProgress /></Box>;

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/technicians')} sx={{ mb: 2 }}>Retour</Button>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>Compétences</Typography>
        {canEdit && <Button variant="contained" startIcon={<Add />} onClick={() => handleOpen()}>Ajouter</Button>}
      </Box>
      <Card>
        <CardContent>
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
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={4}><Typography color="text.secondary">Aucune compétence. Ajoutez-en pour les associer aux techniciens.</Typography></TableCell></TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.description || '—'}</TableCell>
                    {canEdit && (
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleOpen(row)}><Edit /></IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><Delete /></IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Modifier la compétence' : 'Nouvelle compétence'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} margin="normal" required />
          <TextField fullWidth label="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} margin="normal" required />
          <TextField fullWidth label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} margin="normal" multiline rows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>Enregistrer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
