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
  Chip,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import api from '../services/api';
import { useSnackbar } from '../context/SnackbarContext';
import { useAuth } from '../context/AuthContext';

const TOOL_TYPES = [
  { value: 'hand_tool', label: 'Outil manuel' },
  { value: 'power_tool', label: 'Outil électrique' },
  { value: 'measuring', label: 'Mesure' },
  { value: 'safety', label: 'Sécurité' },
  { value: 'other', label: 'Autre' }
];

const STATUS_OPTIONS = [
  { value: 'available', label: 'Disponible' },
  { value: 'in_use', label: 'En usage' },
  { value: 'maintenance', label: 'En maintenance' },
  { value: 'retired', label: 'Hors service' }
];

const emptyForm = () => ({
  code: '',
  name: '',
  description: '',
  tool_type: 'hand_tool',
  manufacturer: '',
  model: '',
  serial_number: '',
  location: '',
  status: 'available',
  calibration_date: '',
  calibration_due_date: '',
  purchase_date: '',
  purchase_price: ''
});

export default function Tools() {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const snackbar = useSnackbar();
  const { can } = useAuth();
  const canEdit = can('tools', 'update');

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    try {
      const res = await api.get('/tools');
      setTools(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setTools([]);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (tool) => {
    setEditingId(tool.id);
    setForm({
      code: tool.code || '',
      name: tool.name || '',
      description: tool.description || '',
      tool_type: tool.tool_type || 'hand_tool',
      manufacturer: tool.manufacturer || '',
      model: tool.model || '',
      serial_number: tool.serial_number || '',
      location: tool.location || '',
      status: tool.status || 'available',
      calibration_date: tool.calibration_date ? tool.calibration_date.slice(0, 10) : '',
      calibration_due_date: tool.calibration_due_date ? tool.calibration_due_date.slice(0, 10) : '',
      purchase_date: tool.purchase_date ? tool.purchase_date.slice(0, 10) : '',
      purchase_price: tool.purchase_price != null ? String(tool.purchase_price) : ''
    });
    setError('');
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const nameStr = (form.name && String(form.name).trim()) || '';
    if (!nameStr) {
      setError('Le nom est requis');
      return;
    }
    setSaving(true);
    if (editingId) {
      const payload = {
        name: nameStr,
        description: form.description?.trim() || null,
        tool_type: form.tool_type || null,
        manufacturer: form.manufacturer?.trim() || null,
        model: form.model?.trim() || null,
        serial_number: form.serial_number?.trim() || null,
        location: form.location?.trim() || null,
        status: form.status || 'available',
        calibration_date: form.calibration_date || null,
        calibration_due_date: form.calibration_due_date || null,
        purchase_date: form.purchase_date || null,
        purchase_price: form.purchase_price === '' ? 0 : parseFloat(form.purchase_price) || 0
      };
      api.put(`/tools/${editingId}`, payload)
        .then(() => {
          snackbar.showSuccess('Outil enregistré');
          setDialogOpen(false);
          loadTools();
        })
        .catch((err) => setError(err.response?.data?.error || 'Erreur enregistrement'))
        .finally(() => setSaving(false));
    } else {
      const payload = {
        name: nameStr,
        description: form.description?.trim() || undefined,
        tool_type: form.tool_type || undefined,
        manufacturer: form.manufacturer?.trim() || undefined,
        model: form.model?.trim() || undefined,
        serial_number: form.serial_number?.trim() || undefined,
        location: form.location?.trim() || undefined,
        calibration_date: form.calibration_date || undefined,
        calibration_due_date: form.calibration_due_date || undefined,
        purchase_date: form.purchase_date || undefined,
        purchase_price: form.purchase_price === '' ? undefined : (parseFloat(form.purchase_price) || 0)
      };
      if (form.code?.trim()) payload.code = form.code.trim();
      api.post('/tools', payload)
        .then(() => {
          snackbar.showSuccess('Outil créé');
          setDialogOpen(false);
          loadTools();
        })
        .catch((err) => setError(err.response?.data?.error || 'Erreur création'))
        .finally(() => setSaving(false));
    }
  };

  const handleDelete = (id) => {
    api.delete(`/tools/${id}`)
      .then(() => {
        setDeleteConfirm(null);
        loadTools();
        snackbar.showSuccess('Outil supprimé');
      })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur suppression'));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Outils et matériels
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestion du parc d'outils de maintenance
          </Typography>
        </Box>
        {canEdit && (
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
            Nouvel outil
          </Button>
        )}
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {tools.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucun outil enregistré
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Nom</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Fabricant</TableCell>
                  <TableCell>Modèle</TableCell>
                  <TableCell>Localisation</TableCell>
                  <TableCell>Statut</TableCell>
                  {canEdit && <TableCell align="right">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {tools.map((tool) => (
                  <TableRow key={tool.id}>
                    <TableCell>{tool.code}</TableCell>
                    <TableCell>{tool.name}</TableCell>
                    <TableCell>{tool.tool_type || '-'}</TableCell>
                    <TableCell>{tool.manufacturer || '-'}</TableCell>
                    <TableCell>{tool.model || '-'}</TableCell>
                    <TableCell>{tool.location || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={tool.status === 'available' ? 'Disponible' : tool.status === 'in_use' ? 'En usage' : tool.status === 'maintenance' ? 'En maintenance' : tool.status === 'retired' ? 'Hors service' : tool.status}
                        color={tool.status === 'available' ? 'success' : tool.status === 'in_use' ? 'warning' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    {canEdit && (
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openEdit(tool)} title="Modifier">
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => setDeleteConfirm(tool)} title="Supprimer" color="error">
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editingId ? 'Modifier l\'outil' : 'Nouvel outil'}</DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}
            <Box display="flex" flexDirection="column" gap={2} pt={1}>
              <TextField
                label="Code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder={editingId ? '' : 'Optionnel (généré si vide)'}
                fullWidth
                disabled={!!editingId}
              />
              <TextField
                label="Nom"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                fullWidth
              />
              <TextField
                label="Description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                multiline
                rows={2}
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={form.tool_type}
                  label="Type"
                  onChange={(e) => setForm((f) => ({ ...f, tool_type: e.target.value }))}
                >
                  {TOOL_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {editingId && (
                <FormControl fullWidth>
                  <InputLabel>Statut</InputLabel>
                  <Select
                    value={form.status}
                    label="Statut"
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <TextField label="Fabricant" value={form.manufacturer} onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))} fullWidth />
              <TextField label="Modèle" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} fullWidth />
              <TextField label="N° de série" value={form.serial_number} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))} fullWidth />
              <TextField label="Localisation" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} fullWidth />
              <TextField type="date" label="Date calibration" value={form.calibration_date} onChange={(e) => setForm((f) => ({ ...f, calibration_date: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
              <TextField type="date" label="Échéance calibration" value={form.calibration_due_date} onChange={(e) => setForm((f) => ({ ...f, calibration_due_date: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
              <TextField type="date" label="Date d'achat" value={form.purchase_date} onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
              <TextField type="number" label="Prix d'achat" value={form.purchase_price} onChange={(e) => setForm((f) => ({ ...f, purchase_price: e.target.value }))} inputProps={{ min: 0, step: 0.01 }} fullWidth />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Supprimer cet outil ?</DialogTitle>
        <DialogContent>
          {deleteConfirm && (
            <Typography>
              {deleteConfirm.code} — {deleteConfirm.name}. Cette action est irréversible.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Annuler</Button>
          <Button color="error" variant="contained" onClick={() => deleteConfirm && handleDelete(deleteConfirm.id)}>
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
