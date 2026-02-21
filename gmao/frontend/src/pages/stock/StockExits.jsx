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
import { Add } from '@mui/icons-material';
import api from '../../services/api';

export default function StockExits() {
  const [exits, setExits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [parts, setParts] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ spare_part_id: '', quantity: 1, work_order_id: '', reference: '', notes: '' });

  useEffect(() => {
    loadExits();
  }, []);

  const loadExits = async () => {
    try {
      const res = await api.get('/stock/exits');
      setExits(res.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadParts = () => {
    api.get('/stock/parts').then((r) => setParts(r.data || [])).catch(() => {});
  };
  const loadWorkOrders = () => {
    api.get('/work-orders').then((r) => setWorkOrders(r.data || [])).catch(() => setWorkOrders([]));
  };

  const handleSubmit = async () => {
    if (!form.spare_part_id || form.quantity < 1) return;
    setSubmitting(true);
    try {
      await api.post('/stock/movements', {
        sparePartId: parseInt(form.spare_part_id, 10),
        quantity: parseInt(form.quantity, 10),
        movementType: 'out',
        workOrderId: form.work_order_id ? parseInt(form.work_order_id, 10) : undefined,
        reference: form.reference || undefined,
        notes: form.notes || undefined
      });
      setOpen(false);
      setForm({ spare_part_id: '', quantity: 1, work_order_id: '', reference: '', notes: '' });
      loadExits();
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
            Sorties de stock
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enregistrement des sorties de pièces
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => { loadParts(); loadWorkOrders(); setOpen(true); }}>
          Nouvelle sortie
        </Button>
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : exits.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucune sortie enregistrée
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Référence</TableCell>
                  <TableCell>Pièce</TableCell>
                  <TableCell>Quantité</TableCell>
                  <TableCell>Ordre de travail</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {exits.map((exit) => (
                  <TableRow key={exit.id}>
                    <TableCell>{new Date(exit.date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>{exit.reference || '-'}</TableCell>
                    <TableCell>{exit.partName}</TableCell>
                    <TableCell>{exit.quantity}</TableCell>
                    <TableCell>{exit.workOrderNumber || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouvelle sortie de stock</DialogTitle>
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
            select
            margin="dense"
            label="Ordre de travail (optionnel)"
            fullWidth
            SelectProps={{ native: true }}
            value={form.work_order_id}
            onChange={(e) => setForm((f) => ({ ...f, work_order_id: e.target.value }))}
          >
            <option value="">Aucun</option>
            {workOrders.map((wo) => (
              <option key={wo.id} value={wo.id}>{wo.number} – {wo.title}</option>
            ))}
          </TextField>
          <TextField
            margin="dense"
            label="Référence"
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
          <Button onClick={() => setOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={submitting || !form.spare_part_id}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
