import React, { useEffect, useState } from 'react';
import { Box, Card, Table, TableBody, TableCell, TableHead, TableRow, Button, CircularProgress, Typography, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useLocation, Link } from 'react-router-dom';
import { Add } from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';

export default function SatisfactionList() {
  const { t } = useTranslation();
  const location = useLocation();
  const workOrderIdFromState = location.state?.workOrderId;
  const [list, setList] = useState([]);
  const [completedWos, setCompletedWos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ workOrderId: workOrderIdFromState || '', rating: '', comment: '' });
  const snackbar = useSnackbar();

  const loadList = () => {
    setLoading(true);
    api.get('/satisfaction').then((r) => setList(Array.isArray(r.data) ? r.data : [])).catch(() => snackbar.showError('Erreur chargement')).finally(() => setLoading(false));
  };

  useEffect(() => { loadList(); }, []);

  useEffect(() => {
    api.get('/work-orders', { params: { status: 'completed', limit: 500 } }).then((r) => {
      const d = r.data?.data ?? r.data;
      setCompletedWos(Array.isArray(d) ? d : []);
    }).catch(() => setCompletedWos([]));
  }, []);

  useEffect(() => { if (workOrderIdFromState) setForm(f => ({ ...f, workOrderId: String(workOrderIdFromState) })); }, [workOrderIdFromState]);

  const handleOpenDialog = () => {
    setForm(f => ({ workOrderId: workOrderIdFromState ? String(workOrderIdFromState) : f.workOrderId, rating: '', comment: '' }));
    setDialogOpen(true);
  };

  const handleCreate = () => {
    const woId = form.workOrderId ? parseInt(form.workOrderId, 10) : null;
    if (!woId) { snackbar.showError('Sélectionnez un OT'); return; }
    setSaving(true);
    api.post('/satisfaction', {
      workOrderId: woId,
      rating: form.rating ? parseInt(form.rating, 10) : undefined,
      comment: form.comment || undefined
    }).then(() => { snackbar.showSuccess('Enquête enregistrée'); setDialogOpen(false); loadList(); })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur'))
      .finally(() => setSaving(false));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>{t('item.satisfaction')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={handleOpenDialog}>Nouvelle enquête satisfaction</Button>
      </Box>
      <Card>
        {loading ? <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box> : (
          <Table>
            <TableHead><TableRow><TableCell>OT</TableCell><TableCell>Titre</TableCell><TableCell>Note</TableCell><TableCell>Commentaire</TableCell><TableCell>Date</TableCell></TableRow></TableHead>
            <TableBody>
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center"><Typography color="text.secondary">Aucune enquête. Les enquêtes se font sur les OT clôturés (menu Maintenance → Satisfaction ou depuis la fiche OT).</Typography></TableCell></TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell><Link to={`/app/work-orders/${row.work_order_id}`} style={{ color: 'inherit', fontWeight: 500 }}>{row.wo_number}</Link></TableCell>
                    <TableCell>{row.wo_title || '—'}</TableCell>
                    <TableCell>{row.rating != null ? `${row.rating}/5` : '—'}</TableCell>
                    <TableCell>{(row.comment || '').slice(0, 60)}{(row.comment || '').length > 60 ? '…' : ''}</TableCell>
                    <TableCell>{row.surveyed_at || '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouvelle enquête satisfaction</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" required sx={{ mt: 1, mb: 2 }}>
            <InputLabel>OT (clôturé)</InputLabel>
            <Select value={form.workOrderId} label="OT (clôturé)" onChange={(e) => setForm(f => ({ ...f, workOrderId: e.target.value }))}>
              {completedWos.map((wo) => <MenuItem key={wo.id} value={wo.id}>{wo.number} - {wo.title || 'Sans titre'}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Note (1 à 5)</InputLabel>
            <Select value={form.rating} label="Note (1 à 5)" onChange={(e) => setForm(f => ({ ...f, rating: e.target.value }))}>
              <MenuItem value="">—</MenuItem>
              {[1, 2, 3, 4, 5].map((n) => <MenuItem key={n} value={n}>{n}/5</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth size="small" label="Commentaire" value={form.comment} onChange={(e) => setForm(f => ({ ...f, comment: e.target.value }))} multiline rows={3} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
