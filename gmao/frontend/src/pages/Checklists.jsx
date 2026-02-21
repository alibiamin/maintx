import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  Alert,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { Add, Edit, Delete, PlayArrow, Remove } from '@mui/icons-material';
import api from '../services/api';
import { useSnackbar } from '../context/SnackbarContext';

export default function Checklists() {
  const location = useLocation();
  const navigate = useNavigate();
  const [checklists, setChecklists] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', maintenance_plan_id: '', is_template: false, items: [{ item_text: '', item_type: 'check', required: true }] });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [executeDialog, setExecuteDialog] = useState(null);
  const [executeResults, setExecuteResults] = useState({});
  const [executeWoId, setExecuteWoId] = useState('');
  const [executeNotes, setExecuteNotes] = useState('');
  const [workOrders, setWorkOrders] = useState([]);
  const snackbar = useSnackbar();

  useEffect(() => {
    loadChecklists();
    api.get('/maintenance-plans').then((r) => setPlans(r.data || [])).catch(() => {});
  }, []);

  const loadChecklists = async () => {
    try {
      const res = await api.get('/checklists');
      setChecklists(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (checklist) => {
    setEditingId(checklist.id);
    const items = (checklist.items || []).length
      ? checklist.items.map((i) => ({
          item_text: i.item_text || '',
          item_type: i.item_type || 'check',
          required: i.required !== 0
        }))
      : [{ item_text: '', item_type: 'check', required: true }];
    setForm({
      name: checklist.name || '',
      description: checklist.description || '',
      maintenance_plan_id: checklist.maintenance_plan_id ?? '',
      is_template: !!checklist.is_template,
      items
    });
    setError('');
    setDialogOpen(true);
  };

  const addItem = () => {
    setForm((f) => ({ ...f, items: [...f.items, { item_text: '', item_type: 'check', required: true }] }));
  };

  const removeItem = (index) => {
    if (form.items.length <= 1) return;
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
  };

  const updateItem = (index, field, value) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const items = form.items
        .filter((i) => i.item_text && i.item_text.trim())
        .map((item, idx) => ({
          item_text: item.item_text.trim(),
          item_type: item.item_type || 'check',
          required: item.required,
          order_index: idx
        }));
      if (items.length === 0) {
        setError('Ajoutez au moins un item à la checklist.');
        setSubmitting(false);
        return;
      }
      if (editingId) {
        await api.put(`/checklists/${editingId}`, {
          name: form.name,
          description: form.description,
          items
        });
      } else {
        await api.post('/checklists', {
          name: form.name,
          description: form.description,
          maintenance_plan_id: form.maintenance_plan_id ? parseInt(form.maintenance_plan_id) : null,
          is_template: form.is_template,
          items
        });
      }
      setDialogOpen(false);
      loadChecklists();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/checklists/${id}`);
      setDeleteConfirm(null);
      loadChecklists();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const openExecute = (checklist, preFillWorkOrderId) => {
    const initial = {};
    (checklist.items || []).forEach((item) => {
      initial[item.id] = item.item_type === 'check' ? { is_ok: false, value: null } : { is_ok: null, value: '' };
    });
    setExecuteResults(initial);
    setExecuteNotes('');
    setExecuteWoId(preFillWorkOrderId != null ? String(preFillWorkOrderId) : '');
    setExecuteDialog(checklist);
    api.get('/work-orders')
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : [];
        setWorkOrders(list.filter((wo) => wo.status === 'pending' || wo.status === 'in_progress'));
      })
      .catch(() => setWorkOrders([]));
  };

  useEffect(() => {
    const s = location.state;
    if (!s?.executeChecklistId || !s?.workOrderId || loading || checklists.length === 0) return;
    const checklist = checklists.find((c) => c.id === s.executeChecklistId);
    if (checklist) {
      openExecute(checklist, s.workOrderId);
      navigate('/checklists', { replace: true, state: {} });
    }
  }, [location.state, loading, checklists]);

  const setExecuteItemResult = (itemId, field, value) => {
    setExecuteResults((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), [field]: value }
    }));
  };

  const handleExecuteSubmit = async () => {
    if (!executeDialog) return;
    setSubmitting(true);
    setError('');
    try {
      const results = (executeDialog.items || []).map((item) => {
        const r = executeResults[item.id] || {};
        if (item.item_type === 'check') {
          return { item_id: item.id, is_ok: !!r.is_ok, value: null };
        }
        return { item_id: item.id, value: r.value != null ? String(r.value) : '', is_ok: null };
      });
      await api.post(`/checklists/${executeDialog.id}/execute`, {
        work_order_id: executeWoId ? parseInt(executeWoId, 10) : null,
        results,
        notes: executeNotes || null
      });
      snackbar.showSuccess('Checklist exécutée.');
      setExecuteDialog(null);
      loadChecklists();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
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
            Checklists de maintenance
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Checklists pour la maintenance préventive
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">Création dans le menu Création</Typography>
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {checklists.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucune checklist enregistrée
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nom</TableCell>
                  <TableCell>Équipement</TableCell>
                  <TableCell>Plan de maintenance</TableCell>
                  <TableCell>Items</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {checklists.map((checklist) => (
                  <TableRow key={checklist.id}>
                    <TableCell>{checklist.name}</TableCell>
                    <TableCell>{checklist.equipment_code || checklist.equipment_name || '-'}</TableCell>
                    <TableCell>{checklist.maintenance_plan_id ? 'Oui' : 'Non'}</TableCell>
                    <TableCell>{checklist.items?.length || 0}</TableCell>
                    <TableCell>
                      <Chip
                        label={checklist.is_template ? 'Modèle' : 'Spécifique'}
                        size="small"
                        color={checklist.is_template ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" title="Exécuter" onClick={() => openExecute(checklist)}>
                        <PlayArrow fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => openEdit(checklist)}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => setDeleteConfirm(checklist.id)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>{editingId ? 'Modifier la checklist' : 'Nouvelle checklist'}</DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}
            <Box display="flex" flexDirection="column" gap={2} pt={1}>
              <TextField
                label="Nom"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                multiline
                rows={2}
                fullWidth
              />
              {!editingId && (
                <>
                  <FormControl fullWidth>
                    <InputLabel>Plan de maintenance</InputLabel>
                    <Select
                      value={form.maintenance_plan_id}
                      label="Plan de maintenance"
                      onChange={(e) => setForm({ ...form, maintenance_plan_id: e.target.value })}
                    >
                      <MenuItem value="">Aucun</MenuItem>
                      {plans.map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          {p.name} ({p.equipment_name || p.equipment_code})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel>Modèle</InputLabel>
                    <Select
                      value={form.is_template ? '1' : '0'}
                      label="Modèle"
                      onChange={(e) => setForm({ ...form, is_template: e.target.value === '1' })}
                    >
                      <MenuItem value="0">Non</MenuItem>
                      <MenuItem value="1">Oui</MenuItem>
                    </Select>
                  </FormControl>
                </>
              )}
              <Typography variant="subtitle2">Items</Typography>
              {form.items.map((item, index) => (
                <Box key={index} display="flex" gap={1} alignItems="flex-start">
                  <TextField
                    label="Libellé"
                    value={item.item_text}
                    onChange={(e) => updateItem(index, 'item_text', e.target.value)}
                    fullWidth
                    size="small"
                  />
                  <FormControl size="small" sx={{ minWidth: 100 }}>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={item.item_type}
                      label="Type"
                      onChange={(e) => updateItem(index, 'item_type', e.target.value)}
                    >
                      <MenuItem value="check">Case à cocher</MenuItem>
                      <MenuItem value="value">Valeur</MenuItem>
                    </Select>
                  </FormControl>
                  <IconButton size="small" onClick={() => removeItem(index)} disabled={form.items.length <= 1}>
                    <Remove />
                  </IconButton>
                </Box>
              ))}
              <Button startIcon={<Add />} onClick={addItem} size="small">
                Ajouter un item
              </Button>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? 'Enregistrement...' : editingId ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Supprimer cette checklist ?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Annuler</Button>
          <Button color="error" variant="contained" onClick={() => handleDelete(deleteConfirm)}>
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!executeDialog} onClose={() => setExecuteDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Exécuter la checklist : {executeDialog?.name}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          <FormControl fullWidth size="small" sx={{ mt: 1, mb: 2 }}>
            <InputLabel>OT lié (optionnel)</InputLabel>
            <Select
              value={executeWoId}
              label="OT lié (optionnel)"
              onChange={(e) => setExecuteWoId(e.target.value)}
            >
              <MenuItem value="">Aucun</MenuItem>
              {workOrders.map((wo) => (
                <MenuItem key={wo.id} value={wo.id}>{wo.number} — {wo.title}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Résultats par item</Typography>
          {(executeDialog?.items || []).map((item) => (
            <Box key={item.id} sx={{ mb: 2 }}>
              {item.item_type === 'check' ? (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!!(executeResults[item.id]?.is_ok)}
                      onChange={(e) => setExecuteItemResult(item.id, 'is_ok', e.target.checked)}
                    />
                  }
                  label={item.item_text}
                />
              ) : (
                <TextField
                  fullWidth
                  size="small"
                  label={item.item_text}
                  value={executeResults[item.id]?.value ?? ''}
                  onChange={(e) => setExecuteItemResult(item.id, 'value', e.target.value)}
                />
              )}
            </Box>
          ))}
          <TextField
            fullWidth
            label="Notes"
            multiline
            rows={2}
            value={executeNotes}
            onChange={(e) => setExecuteNotes(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExecuteDialog(null)}>Annuler</Button>
          <Button variant="contained" onClick={handleExecuteSubmit} disabled={submitting}>
            {submitting ? 'Enregistrement...' : 'Enregistrer l\'exécution'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
