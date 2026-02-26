import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Tooltip
} from '@mui/material';
import { ShoppingCart, Add, CheckCircle, Cancel, ArrowForward } from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';

const STATUS_LABELS = {
  pending: 'En attente',
  approved: 'Demande d\'achat créée',
  ignored: 'Ignoré',
  ordered: 'Commandé',
  partial: 'Partiel',
  received: 'Reçu',
  cancelled: 'Annulé'
};

export default function StockReorders() {
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const [reorders, setReorders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [parts, setParts] = useState([]);
  const [form, setForm] = useState({ spare_part_id: '', quantity_requested: 1, notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [editQuantities, setEditQuantities] = useState({});
  const [savingQtyId, setSavingQtyId] = useState(null);

  useEffect(() => {
    loadReorders();
  }, []);

  const loadReorders = async () => {
    try {
      const res = await api.get('/stock/reorders');
      setReorders(res.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadParts = () => {
    api.get('/stock/parts').then((res) => setParts(res.data || [])).catch(() => setParts([]));
  };

  const handleValidate = async (id) => {
    setActionId(id);
    try {
      const { data } = await api.post(`/stock/reorders/${id}/validate`);
      setActionId(null);
      loadReorders();
      snackbar.showSuccess(`Demande d'achat ${data.purchaseRequest?.pr_number || data.purchaseRequestId} créée. Choisissez un fournisseur pour créer la commande.`);
      navigate('/app/suppliers/purchase-requests');
    } catch (e) {
      setActionId(null);
      snackbar.showError(e.response?.data?.error || 'Erreur lors de la validation.');
    }
  };

  const handleIgnore = async (id) => {
    setActionId(id);
    try {
      await api.post(`/stock/reorders/${id}/ignore`);
      setActionId(null);
      loadReorders();
      snackbar.showSuccess('Demande ignorée.');
    } catch (e) {
      setActionId(null);
      snackbar.showError(e.response?.data?.error || 'Erreur.');
    }
  };

  const handleQuantityBlur = async (reorder) => {
    const id = reorder.id;
    const newQty = editQuantities[id] != null ? parseInt(editQuantities[id], 10) : null;
    if (newQty == null || newQty === reorder.quantity_requested || newQty < 1) {
      setEditQuantities((prev) => ({ ...prev, [id]: undefined }));
      return;
    }
    setSavingQtyId(id);
    try {
      await api.put(`/stock/reorders/${id}`, { quantity_requested: newQty });
      setEditQuantities((prev) => ({ ...prev, [id]: undefined }));
      loadReorders();
      snackbar.showSuccess('Quantité mise à jour.');
    } catch (e) {
      snackbar.showError(e.response?.data?.error || 'Erreur.');
    } finally {
      setSavingQtyId(null);
    }
  };

  const handleCreate = async () => {
    if (!form.spare_part_id || form.quantity_requested < 1) return;
    setSubmitting(true);
    try {
      await api.post('/stock/reorders', {
        spare_part_id: parseInt(form.spare_part_id, 10),
        quantity_requested: parseInt(form.quantity_requested, 10),
        notes: form.notes || undefined
      });
      setCreateOpen(false);
      setForm({ spare_part_id: '', quantity_requested: 1, notes: '' });
      loadReorders();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Demandes d&apos;approvisionnement
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Les alertes stock génèrent des demandes en attente. Validez pour créer une demande d&apos;achat et choisir le fournisseur.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => { loadParts(); setCreateOpen(true); }}>
          Nouvelle demande
        </Button>
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : reorders.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucune demande de réapprovisionnement
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Référence</TableCell>
                  <TableCell>Pièce</TableCell>
                  <TableCell>Quantité demandée</TableCell>
                  <TableCell>Fournisseur</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reorders.map((reorder) => (
                  <TableRow key={reorder.id}>
                    <TableCell>{new Date(reorder.created_at).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>{reorder.reference}</TableCell>
                    <TableCell>{reorder.part_code} – {reorder.part_name}</TableCell>
                    <TableCell>
                      {reorder.status === 'pending' ? (
                        <TextField
                          type="number"
                          size="small"
                          value={editQuantities[reorder.id] ?? reorder.quantity_requested}
                          onChange={(e) => setEditQuantities((prev) => ({ ...prev, [reorder.id]: e.target.value }))}
                          onBlur={() => handleQuantityBlur(reorder)}
                          disabled={!!savingQtyId}
                          inputProps={{ min: 1 }}
                          sx={{ width: 80, '& input': { textAlign: 'right' } }}
                        />
                      ) : (
                        reorder.quantity_requested
                      )}
                      {savingQtyId === reorder.id && <CircularProgress size={14} sx={{ ml: 0.5, verticalAlign: 'middle' }} />}
                    </TableCell>
                    <TableCell>{reorder.supplier_name || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        icon={reorder.status === 'ordered' || reorder.status === 'received' ? <ShoppingCart /> : reorder.status === 'approved' ? <ArrowForward /> : undefined}
                        label={STATUS_LABELS[reorder.status] || reorder.status}
                        size="small"
                        color={reorder.status === 'ordered' || reorder.status === 'received' ? 'success' : reorder.status === 'pending' ? 'warning' : reorder.status === 'ignored' ? 'default' : 'info'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {reorder.status === 'pending' && (
                        <>
                          <Tooltip title="Valider → Créer demande d'achat et choisir fournisseur">
                            <IconButton size="small" color="primary" onClick={() => handleValidate(reorder.id)} disabled={!!actionId}>
                              {actionId === reorder.id ? <CircularProgress size={20} /> : <CheckCircle />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Ignorer">
                            <IconButton size="small" onClick={() => handleIgnore(reorder.id)} disabled={!!actionId}>
                              <Cancel />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      {reorder.status === 'approved' && (
                        <Button size="small" startIcon={<ArrowForward />} onClick={() => navigate('/app/suppliers/purchase-requests')}>
                          Voir demandes d&apos;achat
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouvelle demande de réapprovisionnement</DialogTitle>
        <DialogContent>
          <TextField
            select
            margin="dense"
            label="Pièce"
            fullWidth
            SelectProps={{ native: true }}
            value={form.spare_part_id}
            onChange={(e) => setForm((f) => ({ ...f, spare_part_id: e.target.value }))}
          >
            <option value="">Choisir une pièce</option>
            {parts.map((p) => (
              <option key={p.id} value={p.id}>{p.code} – {p.name} (stock: {p.stock_quantity ?? 0})</option>
            ))}
          </TextField>
          <TextField
            margin="dense"
            label="Quantité demandée"
            type="number"
            fullWidth
            value={form.quantity_requested}
            onChange={(e) => setForm((f) => ({ ...f, quantity_requested: e.target.value }))}
            inputProps={{ min: 1 }}
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
          <Button variant="contained" onClick={handleCreate} disabled={submitting || !form.spare_part_id}>
            Créer la demande
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
