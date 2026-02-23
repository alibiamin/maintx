import React, { useEffect, useState } from 'react';
import { Box, Card, Table, TableBody, TableCell, TableHead, TableRow, Button, CircularProgress, Typography, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useLocation, Link } from 'react-router-dom';
import { Add } from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';

const ANALYSIS_METHODS = ['5M', '5 Why', 'Ishikawa', 'AMDEC', 'Autre'];

export default function RootCausesList() {
  const { t } = useTranslation();
  const location = useLocation();
  const workOrderIdFromState = location.state?.workOrderId;
  const [list, setList] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ workOrderId: workOrderIdFromState || '', equipmentId: '', rootCauseCode: '', rootCauseDescription: '', analysisMethod: '' });
  const snackbar = useSnackbar();

  const loadList = () => {
    setLoading(true);
    const params = workOrderIdFromState ? { workOrderId: workOrderIdFromState } : {};
    api.get('/root-causes', { params }).then((r) => setList(Array.isArray(r.data) ? r.data : [])).catch(() => snackbar.showError('Erreur chargement')).finally(() => setLoading(false));
  };

  useEffect(() => { loadList(); }, [workOrderIdFromState]);

  useEffect(() => {
    api.get('/work-orders', { params: { limit: 500 } }).then((r) => { const d = r.data?.data ?? r.data; setWorkOrders(Array.isArray(d) ? d : []); }).catch(() => setWorkOrders([]));
    api.get('/equipment', { params: { limit: 500 } }).then((r) => { const d = r.data?.data ?? r.data; setEquipment(Array.isArray(d) ? d : []); }).catch(() => setEquipment([]));
  }, []);

  useEffect(() => { if (workOrderIdFromState) setForm(f => ({ ...f, workOrderId: String(workOrderIdFromState) })); }, [workOrderIdFromState]);

  const handleOpenDialog = () => {
    setForm(f => ({ ...f, workOrderId: workOrderIdFromState ? String(workOrderIdFromState) : f.workOrderId, equipmentId: '', rootCauseCode: '', rootCauseDescription: '', analysisMethod: '' }));
    setDialogOpen(true);
  };

  const handleCreate = () => {
    const woId = form.workOrderId ? parseInt(form.workOrderId, 10) : null;
    if (!woId) { snackbar.showError('Sélectionnez un OT'); return; }
    setSaving(true);
    api.post('/root-causes', {
      workOrderId: woId,
      equipmentId: form.equipmentId ? parseInt(form.equipmentId, 10) : undefined,
      rootCauseCode: form.rootCauseCode || undefined,
      rootCauseDescription: form.rootCauseDescription || undefined,
      analysisMethod: form.analysisMethod || undefined
    }).then(() => { snackbar.showSuccess('Cause racine enregistrée'); setDialogOpen(false); loadList(); })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur'))
      .finally(() => setSaving(false));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>{t('item.root_causes')}</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={handleOpenDialog}>Ajouter cause racine</Button>
      </Box>
      <Card>
        {loading ? <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box> : (
          <Table>
            <TableHead><TableRow><TableCell>OT</TableCell><TableCell>Équipement</TableCell><TableCell>Code cause</TableCell><TableCell>Description</TableCell><TableCell>Méthode</TableCell></TableRow></TableHead>
            <TableBody>
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center"><Typography color="text.secondary">Aucune cause racine. Vous pouvez en ajouter depuis cette page ou depuis la fiche OT.</Typography></TableCell></TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell><Link to={`/app/work-orders/${row.work_order_id}`} style={{ color: 'inherit', fontWeight: 500 }}>{row.wo_number}</Link></TableCell>
                    <TableCell>{row.equipment_code || '—'}</TableCell>
                    <TableCell>{row.root_cause_code || '—'}</TableCell>
                    <TableCell>{(row.root_cause_description || '').slice(0, 80)}{(row.root_cause_description || '').length > 80 ? '…' : ''}</TableCell>
                    <TableCell>{row.analysis_method || '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ajouter une cause racine</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" required sx={{ mt: 1, mb: 2 }}>
            <InputLabel>OT</InputLabel>
            <Select value={form.workOrderId} label="OT" onChange={(e) => setForm(f => ({ ...f, workOrderId: e.target.value }))}>
              {workOrders.map((wo) => <MenuItem key={wo.id} value={wo.id}>{wo.number} - {wo.title || 'Sans titre'}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Équipement (optionnel)</InputLabel>
            <Select value={form.equipmentId} label="Équipement (optionnel)" onChange={(e) => setForm(f => ({ ...f, equipmentId: e.target.value }))}>
              <MenuItem value="">— Aucun —</MenuItem>
              {equipment.map((e) => <MenuItem key={e.id} value={e.id}>{e.code} - {e.name || ''}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth size="small" label="Code cause" value={form.rootCauseCode} onChange={(e) => setForm(f => ({ ...f, rootCauseCode: e.target.value }))} sx={{ mb: 2 }} />
          <TextField fullWidth size="small" label="Description" value={form.rootCauseDescription} onChange={(e) => setForm(f => ({ ...f, rootCauseDescription: e.target.value }))} multiline rows={3} sx={{ mb: 2 }} />
          <FormControl fullWidth size="small">
            <InputLabel>Méthode d&apos;analyse</InputLabel>
            <Select value={form.analysisMethod} label="Méthode d'analyse" onChange={(e) => setForm(f => ({ ...f, analysisMethod: e.target.value }))}>
              <MenuItem value="">—</MenuItem>
              {ANALYSIS_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
