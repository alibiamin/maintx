import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Add, CheckCircle, Cancel, Visibility } from '@mui/icons-material';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

const PRIORITY_MAP = { low: 'low', medium: 'medium', high: 'high', critical: 'critical' };
const STATUS_MAP = { pending: 'pending', validated: 'validated', rejected: 'rejected' };

export default function InterventionRequests() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [equipment, setEquipment] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [rejectDialog, setRejectDialog] = useState({ open: false, id: null, reason: '' });
  const [form, setForm] = useState({ title: '', description: '', equipmentId: '', priority: 'medium' });
  const [submitting, setSubmitting] = useState(false);
  const canValidate = user?.role === 'administrateur' || user?.role === 'responsable_maintenance';

  const fetchRequests = () => {
    setLoading(true);
    const params = statusFilter ? { status: statusFilter } : {};
    api.get('/intervention-requests', { params })
      .then((r) => setRequests(r.data || []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  useEffect(() => {
    api.get('/equipment').then((r) => setEquipment(r.data || [])).catch(() => setEquipment([]));
  }, []);

  const handleCreate = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    api.post('/intervention-requests', {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      equipmentId: form.equipmentId ? parseInt(form.equipmentId) : undefined,
      priority: form.priority
    })
      .then(() => {
        setSuccess(t('interventionRequests.created'));
        setForm({ title: '', description: '', equipmentId: '', priority: 'medium' });
        setFormOpen(false);
        fetchRequests();
      })
      .catch((err) => setError(err.response?.data?.error || err.message || 'Erreur'))
      .finally(() => setSubmitting(false));
  };

  const handleValidate = (id) => {
    setError('');
    setSubmitting(true);
    api.put(`/intervention-requests/${id}/validate`)
      .then((r) => {
        setSuccess(t('interventionRequests.validated', { number: r.data?.workOrder?.number }));
        fetchRequests();
        if (r.data?.workOrder?.id) navigate(`/work-orders/${r.data.workOrder.id}`);
      })
      .catch((err) => setError(err.response?.data?.error || err.message || 'Erreur'))
      .finally(() => setSubmitting(false));
  };

  const handleReject = () => {
    if (!rejectDialog.id) return;
    setSubmitting(true);
    api.put(`/intervention-requests/${rejectDialog.id}/reject`, { rejectionReason: rejectDialog.reason })
      .then(() => {
        setSuccess(t('interventionRequests.rejected'));
        setRejectDialog({ open: false, id: null, reason: '' });
        fetchRequests();
      })
      .catch((err) => setError(err.response?.data?.error || err.message || 'Erreur'))
      .finally(() => setSubmitting(false));
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        {t('interventionRequests.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('interventionRequests.subtitle')}
      </Typography>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Tabs value={statusFilter} onChange={(_, v) => setStatusFilter(v)}>
              <Tab value="pending" label={t('interventionRequests.tabs.pending')} />
              <Tab value="validated" label={t('interventionRequests.tabs.validated')} />
              <Tab value="rejected" label={t('interventionRequests.tabs.rejected')} />
            </Tabs>
            <Button startIcon={<Add />} variant="contained" onClick={() => setFormOpen(true)}>
              {t('interventionRequests.newRequest')}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>{t('interventionRequests.table.title')}</TableCell>
              <TableCell>{t('interventionRequests.table.equipment')}</TableCell>
              <TableCell>{t('interventionRequests.table.priority')}</TableCell>
              <TableCell>{t('interventionRequests.table.requestedBy')}</TableCell>
              <TableCell>{t('interventionRequests.table.createdAt')}</TableCell>
              {canValidate && statusFilter === 'pending' && <TableCell align="right">{t('common.actions')}</TableCell>}
              {statusFilter !== 'pending' && <TableCell>{t('interventionRequests.table.result')}</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7}>{t('common.loading')}</TableCell></TableRow>
            ) : requests.length === 0 ? (
              <TableRow><TableCell colSpan={7}>{t('interventionRequests.noData')}</TableCell></TableRow>
            ) : (
              requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>{req.id}</TableCell>
                  <TableCell>{req.title}</TableCell>
                  <TableCell>{req.equipmentName ? `${req.equipmentCode || ''} ${req.equipmentName}`.trim() : '—'}</TableCell>
                  <TableCell><Chip size="small" label={t(`priority.${req.priority}`)} color={req.priority === 'critical' ? 'error' : req.priority === 'high' ? 'warning' : 'default'} /></TableCell>
                  <TableCell>{req.requestedByName || '—'}</TableCell>
                  <TableCell>{req.createdAt ? new Date(req.createdAt).toLocaleString() : '—'}</TableCell>
                  {canValidate && statusFilter === 'pending' && (
                    <TableCell align="right">
                      <Button size="small" startIcon={<CheckCircle />} color="primary" onClick={() => handleValidate(req.id)} disabled={submitting}>
                        {t('interventionRequests.validate')}
                      </Button>
                      <Button size="small" startIcon={<Cancel />} onClick={() => setRejectDialog({ open: true, id: req.id, reason: '' })} disabled={submitting}>
                        {t('interventionRequests.reject')}
                      </Button>
                    </TableCell>
                  )}
                  {statusFilter !== 'pending' && (
                    <TableCell>
                      {req.status === 'validated' && req.workOrderNumber ? (
                        <Button size="small" startIcon={<Visibility />} onClick={() => navigate(`/work-orders/${req.workOrderId}`)}>
                          {req.workOrderNumber}
                        </Button>
                      ) : req.status === 'rejected' && req.rejectionReason ? (
                        req.rejectionReason
                      ) : (
                        req.status === 'validated' ? t('interventionRequests.validatedShort') : t('interventionRequests.rejectedShort')
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('interventionRequests.newRequest')}</DialogTitle>
        <form onSubmit={handleCreate}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField fullWidth label={t('interventionRequests.table.title')} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth multiline rows={2} label={t('interventionRequests.description')} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>{t('interventionRequests.table.equipment')}</InputLabel>
                  <Select value={form.equipmentId} label={t('interventionRequests.table.equipment')} onChange={(e) => setForm((f) => ({ ...f, equipmentId: e.target.value }))}>
                    <MenuItem value="">—</MenuItem>
                    {equipment.map((eq) => <MenuItem key={eq.id} value={String(eq.id)}>{eq.code} {eq.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>{t('interventionRequests.priority')}</InputLabel>
                  <Select value={form.priority} label={t('interventionRequests.priority')} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                    <MenuItem value="low">{t('priority.low')}</MenuItem>
                    <MenuItem value="medium">{t('priority.medium')}</MenuItem>
                    <MenuItem value="high">{t('priority.high')}</MenuItem>
                    <MenuItem value="critical">{t('priority.critical')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" variant="contained" disabled={submitting || !form.title.trim()}>{submitting ? t('common.saving') : t('common.save')}</Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={rejectDialog.open} onClose={() => setRejectDialog((d) => ({ ...d, open: false }))}>
        <DialogTitle>{t('interventionRequests.reject')}</DialogTitle>
        <DialogContent>
          <TextField fullWidth multiline label={t('interventionRequests.rejectionReason')} value={rejectDialog.reason} onChange={(e) => setRejectDialog((d) => ({ ...d, reason: e.target.value }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog((d) => ({ ...d, open: false }))}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" onClick={handleReject} disabled={submitting}>{t('interventionRequests.reject')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
