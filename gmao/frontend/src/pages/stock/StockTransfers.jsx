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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import { SwapHoriz, Add } from '@mui/icons-material';
import api from '../../services/api';

export default function StockTransfers() {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [parts, setParts] = useState([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ spare_part_id: '', quantity: 1, notes: '' });

  useEffect(() => {
    loadTransfers();
  }, []);

  const loadTransfers = async () => {
    try {
      const res = await api.get('/stock/transfers');
      setTransfers(res.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadParts = () => {
    api.get('/stock/parts').then((r) => setParts(r.data || [])).catch(() => {});
  };

  const handleSubmit = async () => {
    if (!form.spare_part_id || form.quantity < 1) return;
    setSubmitting(true);
    try {
      await api.post('/stock/movements', {
        sparePartId: parseInt(form.spare_part_id, 10),
        quantity: parseInt(form.quantity, 10),
        movementType: 'transfer',
        notes: form.notes || undefined
      });
      setOpen(false);
      setForm({ spare_part_id: '', quantity: 1, notes: '' });
      loadTransfers();
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
            Transferts de stock
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Transferts entre emplacements
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => { loadParts(); setOpen(true); }}>
          Nouveau transfert
        </Button>
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : transfers.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucun transfert enregistré
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Référence</TableCell>
                  <TableCell>Pièce</TableCell>
                  <TableCell>Quantité</TableCell>
                  <TableCell>Utilisateur</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell>{new Date(transfer.date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>{transfer.reference || '-'}</TableCell>
                    <TableCell>{transfer.partName}</TableCell>
                    <TableCell>{Math.abs(transfer.quantity)}</TableCell>
                    <TableCell>{transfer.userName || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouveau transfert</DialogTitle>
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
            label="Quantité"
            type="number"
            fullWidth
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
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
          <Button onClick={() => setOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={submitting || !form.spare_part_id}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
