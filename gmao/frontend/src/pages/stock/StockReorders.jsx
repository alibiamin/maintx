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
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import { ShoppingCart, Add } from '@mui/icons-material';
import api from '../../services/api';

const STATUS_LABELS = { pending: 'En attente', ordered: 'Commandé', partial: 'Partiel', received: 'Reçu', cancelled: 'Annulé' };

export default function StockReorders() {
  const [reorders, setReorders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [parts, setParts] = useState([]);
  const [form, setForm] = useState({ spare_part_id: '', quantity_requested: 1, notes: '' });
  const [submitting, setSubmitting] = useState(false);

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
            Réapprovisionnements
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Demandes de réapprovisionnement et commandes
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
                </TableRow>
              </TableHead>
              <TableBody>
                {reorders.map((reorder) => (
                  <TableRow key={reorder.id}>
                    <TableCell>{new Date(reorder.created_at).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>{reorder.reference}</TableCell>
                    <TableCell>{reorder.part_code} – {reorder.part_name}</TableCell>
                    <TableCell>{reorder.quantity_requested}</TableCell>
                    <TableCell>{reorder.supplier_name || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        icon={reorder.status === 'ordered' || reorder.status === 'received' ? <ShoppingCart /> : undefined}
                        label={STATUS_LABELS[reorder.status] || reorder.status}
                        size="small"
                        color={reorder.status === 'ordered' || reorder.status === 'received' ? 'success' : 'default'}
                      />
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
