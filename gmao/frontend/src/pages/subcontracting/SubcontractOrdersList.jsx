import React, { useEffect, useState } from 'react';
import { Box, Card, Table, TableBody, TableCell, TableHead, TableRow, Button, CircularProgress, Typography, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Add } from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';

const STATUS_LABELS = { draft: 'Brouillon', sent: 'Envoyé', in_progress: 'En cours', completed: 'Terminé', cancelled: 'Annulé', invoiced: 'Facturé' };

export default function SubcontractOrdersList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const contractorId = searchParams.get('contractorId');
  const [list, setList] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ contractorId: contractorId || '', workOrderId: '', description: '', orderDate: new Date().toISOString().slice(0, 10), expectedDate: '', amount: '', notes: '' });
  const snackbar = useSnackbar();

  const loadList = () => {
    setLoading(true);
    const url = contractorId ? `/subcontract-orders?contractorId=${contractorId}` : '/subcontract-orders';
    api.get(url).then((r) => setList(Array.isArray(r.data) ? r.data : [])).catch(() => snackbar.showError('Erreur chargement')).finally(() => setLoading(false));
  };

  useEffect(() => { loadList(); }, [contractorId]);

  useEffect(() => {
    api.get('/external-contractors').then((r) => setContractors(Array.isArray(r.data) ? r.data : [])).catch(() => setContractors([]));
    api.get('/work-orders', { params: { limit: 500 } }).then((r) => {
      const data = r.data?.data ?? r.data;
      setWorkOrders(Array.isArray(data) ? data : []);
    }).catch(() => setWorkOrders([]));
  }, []);

  const handleOpenDialog = () => {
    setForm({ contractorId: contractorId || '', workOrderId: '', description: '', orderDate: new Date().toISOString().slice(0, 10), expectedDate: '', amount: '', notes: '' });
    setDialogOpen(true);
  };

  const handleCreate = () => {
    const contractorIdNum = form.contractorId ? parseInt(form.contractorId, 10) : null;
    if (!contractorIdNum) { snackbar.showError('Sélectionnez un sous-traitant'); return; }
    setSaving(true);
    api.post('/subcontract-orders', {
      contractorId: contractorIdNum,
      workOrderId: form.workOrderId ? parseInt(form.workOrderId, 10) : undefined,
      description: form.description || undefined,
      orderDate: form.orderDate || undefined,
      expectedDate: form.expectedDate || undefined,
      amount: form.amount !== '' ? parseFloat(form.amount) : undefined,
      notes: form.notes || undefined
    }).then(() => { snackbar.showSuccess('Ordre créé'); setDialogOpen(false); loadList(); })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur'))
      .finally(() => setSaving(false));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>{t('item.subcontract_orders')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={handleOpenDialog}>Nouvel ordre</Button>
      </Box>
      <Card>
        {loading ? <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box> : (
          <Table>
            <TableHead><TableRow><TableCell>N°</TableCell><TableCell>Sous-traitant</TableCell><TableCell>OT</TableCell><TableCell>Statut</TableCell><TableCell>Montant</TableCell><TableCell>Date</TableCell></TableRow></TableHead>
            <TableBody>
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center"><Typography color="text.secondary">Aucun ordre de sous-traitance. Cliquez sur &quot;Nouvel ordre&quot; pour en créer un.</Typography></TableCell></TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.number}</TableCell>
                    <TableCell>{row.contractor_name}</TableCell>
                    <TableCell>
                      {row.work_order_id ? (
                        <Link to={`/app/work-orders/${row.work_order_id}`} style={{ color: 'inherit' }}>{row.wo_number ? `${row.wo_number} - ${row.wo_title || ''}` : `OT #${row.work_order_id}`}</Link>
                      ) : (row.wo_number ? `${row.wo_number} - ${row.wo_title || ''}` : '—')}
                    </TableCell>
                    <TableCell>{STATUS_LABELS[row.status] || row.status}</TableCell>
                    <TableCell>{row.amount != null ? `${Number(row.amount).toLocaleString('fr-FR')} €` : '—'}</TableCell>
                    <TableCell>{row.order_date || '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouvel ordre de sous-traitance</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" required sx={{ mt: 1, mb: 2 }}>
            <InputLabel>Sous-traitant</InputLabel>
            <Select value={form.contractorId} label="Sous-traitant" onChange={(e) => setForm(f => ({ ...f, contractorId: e.target.value }))}>
              {contractors.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>OT lié (optionnel)</InputLabel>
            <Select value={form.workOrderId} label="OT lié (optionnel)" onChange={(e) => setForm(f => ({ ...f, workOrderId: e.target.value }))}>
              <MenuItem value="">— Aucun —</MenuItem>
              {workOrders.map((wo) => <MenuItem key={wo.id} value={wo.id}>{wo.number} - {wo.title || 'Sans titre'}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth size="small" label="Description" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} multiline rows={2} sx={{ mb: 2 }} />
          <Box display="flex" gap={2} sx={{ mb: 2 }}>
            <TextField type="date" size="small" label="Date commande" value={form.orderDate} onChange={(e) => setForm(f => ({ ...f, orderDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
            <TextField type="date" size="small" label="Date prévue" value={form.expectedDate} onChange={(e) => setForm(f => ({ ...f, expectedDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
          </Box>
          <TextField fullWidth size="small" type="number" label="Montant (€)" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} inputProps={{ min: 0, step: 0.01 }} sx={{ mb: 2 }} />
          <TextField fullWidth size="small" label="Notes" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} multiline rows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>{saving ? 'Création...' : 'Créer'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
