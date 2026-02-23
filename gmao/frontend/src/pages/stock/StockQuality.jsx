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
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Cancel from '@mui/icons-material/Cancel';
import SwapHoriz from '@mui/icons-material/SwapHoriz';
import api from '../../services/api';

const STATUS_LABELS = { A: 'Accepté', Q: 'Quarantaine', R: 'Rejeté' };

export default function StockQuality() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [action, setAction] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ quantity: 1, notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [changeStatusOpen, setChangeStatusOpen] = useState(false);
  const [changeStatusRow, setChangeStatusRow] = useState(null);
  const [changeStatusForm, setChangeStatusForm] = useState({ fromStatus: 'Q', toStatus: 'A', quantity: 1, notes: '' });
  const [changeStatusSubmitting, setChangeStatusSubmitting] = useState(false);
  const [changeStatusError, setChangeStatusError] = useState('');

  const loadQuarantine = () => {
    setLoading(true);
    api.get('/stock/quarantine')
      .then((r) => setItems(Array.isArray(r.data) ? r.data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadQuarantine();
  }, []);

  const openRelease = (row) => {
    setSelected(row);
    setAction('release');
    setForm({ quantity: Math.max(1, row.quantity_quarantine || 0), notes: '' });
    setError('');
    setDialogOpen(true);
  };

  const openReject = (row) => {
    setSelected(row);
    setAction('reject');
    setForm({ quantity: Math.max(1, row.quantity_quarantine || 0), notes: '' });
    setError('');
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!selected || form.quantity < 1) return;
    const qty = parseInt(form.quantity, 10);
    if (qty > (selected.quantity_quarantine || 0)) {
      setError(`Quantité max en quarantaine : ${selected.quantity_quarantine}`);
      return;
    }
    setSubmitting(true);
    setError('');
    api.post('/stock/quality/release', {
      sparePartId: selected.id,
      quantity: qty,
      action,
      notes: (form.notes || '').trim() || undefined
    })
      .then(() => {
        setDialogOpen(false);
        setSelected(null);
        loadQuarantine();
      })
      .catch((e) => setError(e.response?.data?.error || e.message || 'Erreur'))
      .finally(() => setSubmitting(false));
  };

  const openChangeStatus = (row) => {
    const acc = row.quantity_accepted ?? 0;
    const quar = row.quantity_quarantine ?? 0;
    const rej = row.quantity_rejected ?? 0;
    const from = quar > 0 ? 'Q' : (acc > 0 ? 'A' : 'R');
    const to = from === 'Q' ? 'A' : (from === 'A' ? 'Q' : 'A');
    const maxQty = from === 'A' ? acc : (from === 'Q' ? quar : rej);
    setChangeStatusRow(row);
    setChangeStatusForm({ fromStatus: from, toStatus: to, quantity: Math.min(1, maxQty) || 1, notes: '' });
    setChangeStatusError('');
    setChangeStatusOpen(true);
  };

  const handleChangeStatusSubmit = () => {
    if (!changeStatusRow) return;
    const acc = changeStatusRow.quantity_accepted ?? 0;
    const quar = changeStatusRow.quantity_quarantine ?? 0;
    const rej = changeStatusRow.quantity_rejected ?? 0;
    const maxQty = changeStatusForm.fromStatus === 'A' ? acc : (changeStatusForm.fromStatus === 'Q' ? quar : rej);
    if (changeStatusForm.quantity < 1 || changeStatusForm.quantity > maxQty) {
      setChangeStatusError(`Quantité invalide (max ${maxQty})`);
      return;
    }
    if (changeStatusForm.fromStatus === changeStatusForm.toStatus) {
      setChangeStatusError('Choisir un statut cible différent');
      return;
    }
    setChangeStatusSubmitting(true);
    setChangeStatusError('');
    api.post('/stock/quality/change-status', {
      sparePartId: changeStatusRow.id,
      fromStatus: changeStatusForm.fromStatus,
      toStatus: changeStatusForm.toStatus,
      quantity: changeStatusForm.quantity,
      notes: (changeStatusForm.notes || '').trim() || undefined
    })
      .then(() => {
        setChangeStatusOpen(false);
        setChangeStatusRow(null);
        loadQuarantine();
      })
      .catch((e) => setChangeStatusError(e.response?.data?.error || e.message || 'Erreur'))
      .finally(() => setChangeStatusSubmitting(false));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Contrôle qualité — Libération / Rejet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Stock en quarantaine (Q) : libérer vers Accepté (A) ou rejeter (R). Seul le stock <strong>Accepté (A)</strong> peut être utilisé dans les OT et projets.
          </Typography>
        </Box>
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
          ) : items.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucun stock en quarantaine
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Désignation</TableCell>
                  <TableCell>Fournisseur</TableCell>
                  <TableCell align="right">Quarantaine (Q)</TableCell>
                  <TableCell align="right">Accepté (A)</TableCell>
                  <TableCell align="right">Rejeté (R)</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.supplier_name || '—'}</TableCell>
                    <TableCell align="right">{row.quantity_quarantine ?? 0}</TableCell>
                    <TableCell align="right">{row.quantity_accepted ?? 0}</TableCell>
                    <TableCell align="right">{row.quantity_rejected ?? 0}</TableCell>
                    <TableCell align="right">
                      <Button size="small" startIcon={<CheckCircle />} color="primary" onClick={() => openRelease(row)} sx={{ mr: 0.5 }}>
                        Libérer
                      </Button>
                      <Button size="small" startIcon={<Cancel />} color="error" onClick={() => openReject(row)} sx={{ mr: 0.5 }}>
                        Rejeter
                      </Button>
                      <Button size="small" startIcon={<SwapHoriz />} onClick={() => openChangeStatus(row)} title="Changer le statut (A/Q/R)">
                        Statut
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => !submitting && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {action === 'release' ? 'Libérer (Q → A)' : 'Rejeter (Q → R)'} — {selected?.code}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            {error && <Typography color="error">{error}</Typography>}
            <TextField
              type="number"
              label="Quantité"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              inputProps={{ min: 1, max: selected?.quantity_quarantine || 0 }}
              fullWidth
            />
            <TextField
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              multiline
              rows={2}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>Annuler</Button>
          <Button variant="contained" color={action === 'reject' ? 'error' : 'primary'} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'En cours...' : (action === 'release' ? 'Libérer' : 'Rejeter')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={changeStatusOpen} onClose={() => !changeStatusSubmitting && setChangeStatusOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Changer le statut (total ou partiel) — {changeStatusRow?.code}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {changeStatusError && <Typography color="error">{changeStatusError}</Typography>}
            <FormControl fullWidth>
              <InputLabel>Statut source</InputLabel>
              <Select
                value={changeStatusForm.fromStatus}
                label="Statut source"
                onChange={(e) => {
                  const from = e.target.value;
                  const acc = changeStatusRow?.quantity_accepted ?? 0;
                  const quar = changeStatusRow?.quantity_quarantine ?? 0;
                  const rej = changeStatusRow?.quantity_rejected ?? 0;
                  const maxQty = from === 'A' ? acc : (from === 'Q' ? quar : rej);
                  setChangeStatusForm((f) => ({ ...f, fromStatus: from, quantity: Math.min(f.quantity, maxQty) || 1 }));
                }}
              >
                <MenuItem value="A">A — Accepté (disponible : {changeStatusRow?.quantity_accepted ?? 0})</MenuItem>
                <MenuItem value="Q">Q — Quarantaine (disponible : {changeStatusRow?.quantity_quarantine ?? 0})</MenuItem>
                <MenuItem value="R">R — Rejeté (disponible : {changeStatusRow?.quantity_rejected ?? 0})</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Statut cible</InputLabel>
              <Select
                value={changeStatusForm.toStatus}
                label="Statut cible"
                onChange={(e) => setChangeStatusForm((f) => ({ ...f, toStatus: e.target.value }))}
              >
                <MenuItem value="A">A — Accepté</MenuItem>
                <MenuItem value="Q">Q — Quarantaine</MenuItem>
                <MenuItem value="R">R — Rejeté</MenuItem>
              </Select>
            </FormControl>
            <TextField
              type="number"
              label="Quantité"
              value={changeStatusForm.quantity}
              onChange={(e) => setChangeStatusForm((f) => ({ ...f, quantity: parseInt(e.target.value, 10) || 0 }))}
              inputProps={{
                min: 1,
                max: changeStatusForm.fromStatus === 'A' ? (changeStatusRow?.quantity_accepted ?? 0) : (changeStatusForm.fromStatus === 'Q' ? (changeStatusRow?.quantity_quarantine ?? 0) : (changeStatusRow?.quantity_rejected ?? 0))
              }}
              fullWidth
            />
            <TextField label="Notes" value={changeStatusForm.notes} onChange={(e) => setChangeStatusForm((f) => ({ ...f, notes: e.target.value }))} multiline rows={2} fullWidth />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangeStatusOpen(false)} disabled={changeStatusSubmitting}>Annuler</Button>
          <Button variant="contained" onClick={handleChangeStatusSubmit} disabled={changeStatusSubmitting}>
            {changeStatusSubmitting ? 'En cours...' : 'Appliquer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
