import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton
} from '@mui/material';
import { Add, CheckCircle, Schedule, Visibility, Done } from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';

const STATUS_LABELS = { draft: 'Brouillon', in_progress: 'En cours', completed: 'Clôturé', cancelled: 'Annulé' };

export default function StockInventories() {
  const [inventories, setInventories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [parts, setParts] = useState([]);
  const [form, setForm] = useState({ inventory_date: new Date().toISOString().slice(0, 10), reference: '', notes: '' });
  const [lineForm, setLineForm] = useState({ spare_part_id: '', quantity_counted: '' });
  const [submitting, setSubmitting] = useState(false);
  const snackbar = useSnackbar();

  useEffect(() => {
    loadInventories();
  }, []);

  const loadInventories = async () => {
    try {
      const res = await api.get('/stock/inventories');
      setInventories(res.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadParts = async () => {
    try {
      const res = await api.get('/stock/parts');
      setParts(res.data || []);
    } catch (_) {}
  };

  const openDetail = async (id) => {
    setDetail(null);
    setDetailOpen(true);
    loadParts();
    try {
      const res = await api.get(`/stock/inventories/${id}`);
      setDetail(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async () => {
    if (!form.inventory_date) return;
    setSubmitting(true);
    try {
      await api.post('/stock/inventories', {
        inventory_date: form.inventory_date,
        reference: form.reference || undefined,
        notes: form.notes || undefined
      });
      setCreateOpen(false);
      setForm({ inventory_date: new Date().toISOString().slice(0, 10), reference: '', notes: '' });
      loadInventories();
      snackbar.showSuccess('Inventaire créé');
    } catch (e) {
      snackbar.showError(e.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddLine = async () => {
    if (!detail || !lineForm.spare_part_id || lineForm.quantity_counted === '') return;
    setSubmitting(true);
    try {
      await api.post(`/stock/inventories/${detail.id}/lines`, {
        spare_part_id: parseInt(lineForm.spare_part_id, 10),
        quantity_counted: parseInt(lineForm.quantity_counted, 10),
        notes: lineForm.notes || undefined
      });
      const res = await api.get(`/stock/inventories/${detail.id}`);
      setDetail(res.data);
      setLineForm({ spare_part_id: '', quantity_counted: '', notes: '' });
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!detail) return;
    setSubmitting(true);
    try {
      await api.post(`/stock/inventories/${detail.id}/complete`);
      const res = await api.get(`/stock/inventories/${detail.id}`);
      setDetail(res.data);
      loadInventories();
      snackbar.showSuccess('Inventaire validé');
    } catch (e) {
      snackbar.showError(e.response?.data?.error || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Inventaires
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestion des inventaires physiques
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setCreateOpen(true); }}>
          Nouvel inventaire
        </Button>
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : inventories.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucun inventaire enregistré
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Référence</TableCell>
                  <TableCell>Responsable</TableCell>
                  <TableCell>Pièces comptées</TableCell>
                  <TableCell>Écarts</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inventories.map((inv) => (
                  <TableRow key={inv.id} hover>
                    <TableCell>{new Date(inv.inventory_date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>{inv.reference}</TableCell>
                    <TableCell>{inv.responsible_name || '-'}</TableCell>
                    <TableCell>{inv.items_count ?? 0}</TableCell>
                    <TableCell>
                      <Chip
                        label={inv.discrepancies ?? 0}
                        size="small"
                        color={(inv.discrepancies || 0) > 0 ? 'error' : 'success'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={inv.status === 'completed' ? <CheckCircle /> : <Schedule />}
                        label={STATUS_LABELS[inv.status] || inv.status}
                        size="small"
                        color={inv.status === 'completed' ? 'success' : 'warning'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openDetail(inv.id)} title="Détail">
                        <Visibility />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Création */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouvel inventaire</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="Date"
            type="date"
            fullWidth
            value={form.inventory_date}
            onChange={(e) => setForm((f) => ({ ...f, inventory_date: e.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            margin="dense"
            label="Référence (optionnel)"
            fullWidth
            value={form.reference}
            onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
          />
          <TextField
            margin="dense"
            label="Notes"
            fullWidth
            multiline
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleCreate} disabled={submitting}>
            Créer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Détail + lignes */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Inventaire {detail?.reference}
          {detail?.status !== 'completed' && (
            <Chip label={STATUS_LABELS[detail?.status] || detail?.status} size="small" sx={{ ml: 1 }} color="warning" />
          )}
        </DialogTitle>
        <DialogContent>
          {detail && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Date : {new Date(detail.inventory_date).toLocaleDateString('fr-FR')} — Responsable : {detail.responsible_name || '-'}
              </Typography>
              <Table size="small" sx={{ mt: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Pièce</TableCell>
                    <TableCell align="right">Qté système</TableCell>
                    <TableCell align="right">Qté comptée</TableCell>
                    <TableCell align="right">Écart</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(detail.lines || []).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.part_code} – {l.part_name}</TableCell>
                      <TableCell align="right">{l.quantity_system}</TableCell>
                      <TableCell align="right">{l.quantity_counted}</TableCell>
                      <TableCell align="right">
                        <Chip size="small" label={l.variance} color={(l.variance || 0) !== 0 ? 'error' : 'default'} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {detail.status !== 'completed' && (
                <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                  <TextField
                    select
                    size="small"
                    label="Pièce"
                    SelectProps={{ native: true }}
                    value={lineForm.spare_part_id}
                    onChange={(e) => { setLineForm((f) => ({ ...f, spare_part_id: e.target.value })); loadParts(); }}
                    onFocus={loadParts}
                    sx={{ minWidth: 220 }}
                  >
                    <option value="">Choisir une pièce</option>
                    {parts.map((p) => (
                      <option key={p.id} value={p.id}>{p.code} – {p.name}</option>
                    ))}
                  </TextField>
                  <TextField
                    type="number"
                    size="small"
                    label="Quantité comptée"
                    value={lineForm.quantity_counted}
                    onChange={(e) => setLineForm((f) => ({ ...f, quantity_counted: e.target.value }))}
                    inputProps={{ min: 0 }}
                    sx={{ width: 120 }}
                  />
                  <Button variant="outlined" onClick={handleAddLine} disabled={submitting || !lineForm.spare_part_id || lineForm.quantity_counted === ''}>
                    Ajouter ligne
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Fermer</Button>
          {detail?.status !== 'completed' && detail?.lines?.length > 0 && (
            <Button variant="contained" color="primary" startIcon={<Done />} onClick={handleComplete} disabled={submitting}>
              Valider l'inventaire
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
