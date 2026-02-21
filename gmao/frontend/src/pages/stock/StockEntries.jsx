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

export default function StockEntries() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [parts, setParts] = useState([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ spare_part_id: '', quantity: 1, reference: '', notes: '' });

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const res = await api.get('/stock/entries');
      setEntries(res.data || []);
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
        movementType: 'in',
        reference: form.reference || undefined,
        notes: form.notes || undefined
      });
      setOpen(false);
      setForm({ spare_part_id: '', quantity: 1, reference: '', notes: '' });
      loadEntries();
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
            Entrées de stock
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enregistrement des réceptions de pièces
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => { loadParts(); setOpen(true); }}>
          Nouvelle entrée
        </Button>
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : entries.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucune entrée enregistrée
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Référence</TableCell>
                  <TableCell>Pièce</TableCell>
                  <TableCell>Quantité</TableCell>
                  <TableCell>Fournisseur</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{new Date(entry.date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>{entry.reference || '-'}</TableCell>
                    <TableCell>{entry.partName}</TableCell>
                    <TableCell>{entry.quantity}</TableCell>
                    <TableCell>{entry.supplierName || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouvelle entrée de stock</DialogTitle>
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
              <option key={p.id} value={p.id}>{p.code} – {p.name}</option>
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
            label="Référence (bon de livraison, etc.)"
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
