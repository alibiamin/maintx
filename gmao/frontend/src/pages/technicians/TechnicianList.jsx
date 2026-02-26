import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  CircularProgress,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  TablePagination,
  IconButton,
  Tooltip,
  Alert
} from '@mui/material';
import { PersonAdd, Star, StarBorder, RateReview, Refresh } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSnackbar } from '../../context/SnackbarContext';
import { useCurrency } from '../../context/CurrencyContext';

function TechnicianList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', firstName: '', lastName: '', hourlyRate: '',
    phone: '', address: '', city: '', postalCode: '', employeeNumber: '',
    jobTitle: '', department: '', hireDate: '', contractType: ''
  });
  const [saving, setSaving] = useState(false);
  const [evalDialog, setEvalDialog] = useState({ open: false, tech: null, score: 3, comment: '' });
  const [savingEval, setSavingEval] = useState(false);
  const { can } = useAuth();
  const snackbar = useSnackbar();
  const currency = useCurrency();
  const canAdd = can('technicians', 'create');

  const roleLabel = (roleName) => {
    if (roleName === 'technicien') return t('effectif.roleTechnicien');
    if (roleName === 'responsable_maintenance') return t('effectif.roleResponsable');
    return roleName || '';
  };

  const load = useCallback(() => {
    setError(null);
    setLoading(true);
    api.get('/technicians', { params: { page: page + 1, limit: rowsPerPage } })
      .then((r) => {
        const res = r.data;
        if (Array.isArray(res)) {
          setList(res);
          setTotal(res.length);
        } else {
          setList(res?.data ?? []);
          setTotal(res?.total ?? 0);
        }
      })
      .catch(() => {
        setError(t('effectif.errorLoad'));
        setList([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page, rowsPerPage, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleChangePage = (_, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const openEvalDialog = (tech, e) => {
    if (e) e.stopPropagation();
    setEvalDialog({ open: true, tech, score: 3, comment: '' });
  };
  const closeEvalDialog = () => setEvalDialog({ open: false, tech: null, score: 3, comment: '' });
  const handleSubmitEval = () => {
    if (!evalDialog.tech) return;
    setSavingEval(true);
    api.post(`/technicians/${evalDialog.tech.id}/evaluations`, {
      score: evalDialog.score,
      comment: evalDialog.comment || undefined
    })
      .then(() => {
        snackbar.showSuccess(t('effectif.evalSaved'));
        closeEvalDialog();
        load();
      })
      .catch(() => snackbar.showError(t('effectif.evalError')))
      .finally(() => setSavingEval(false));
  };

  const renderStars = (avgScore) => {
    if (avgScore == null) return null;
    const n = Math.min(5, Math.max(0, Math.round(avgScore)));
    return (
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
        {[1, 2, 3, 4, 5].map((i) =>
          (i <= n ? <Star key={i} sx={{ fontSize: 16, color: 'warning.main' }} /> : <StarBorder key={i} sx={{ fontSize: 16, color: 'action.disabled' }} />)
        )}
      </Box>
    );
  };

  const handleOpenDialog = () => {
    setForm({
      email: '', password: '', firstName: '', lastName: '', hourlyRate: '',
      phone: '', address: '', city: '', postalCode: '', employeeNumber: '',
      jobTitle: '', department: '', hireDate: '', contractType: ''
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => setDialogOpen(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.email?.trim() || !form.password || form.password.length < 8 || !form.firstName?.trim() || !form.lastName?.trim()) {
      snackbar.showError(t('effectif.requiredFieldsError'));
      return;
    }
    setSaving(true);
    const payload = {
      email: form.email.trim(),
      password: form.password,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      hourlyRate: form.hourlyRate.trim() ? parseFloat(form.hourlyRate.replace(',', '.')) : undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      postalCode: form.postalCode.trim() || undefined,
      employeeNumber: form.employeeNumber.trim() || undefined,
      jobTitle: form.jobTitle.trim() || undefined,
      department: form.department.trim() || undefined,
      hireDate: form.hireDate || undefined,
      contractType: form.contractType.trim() || undefined
    };
    api.post('/technicians', payload)
      .then((r) => {
        setDialogOpen(false);
        setPage(0);
        load();
        snackbar.showSuccess(t('effectif.technicianCreated'));
        if (r.data?.id) navigate(`/app/technicians/${r.data.id}`);
      })
      .catch((err) => snackbar.showError(err.response?.data?.error || t('effectif.creationError')))
      .finally(() => setSaving(false));
  };

  if (loading && list.length === 0) {
    return (
      <Box p={4} display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('effectif.listTitle')}</Typography>
          <Typography variant="body2" color="text.secondary">{t('effectif.listSubtitle')}</Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
          <Tooltip title={t('common.refresh')}>
            <IconButton onClick={load} disabled={loading} color="primary" size="medium">
              <Refresh />
            </IconButton>
          </Tooltip>
          {canAdd && (
            <Button variant="contained" startIcon={<PersonAdd />} onClick={handleOpenDialog}>
              {t('effectif.addTechnician')}
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Dialog open={evalDialog.open} onClose={closeEvalDialog} maxWidth="xs" fullWidth>
        <DialogTitle>
          {evalDialog.tech
            ? t('effectif.evaluateTitle', { name: `${evalDialog.tech.first_name || ''} ${evalDialog.tech.last_name || ''}`.trim() })
            : ''}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>{t('effectif.evaluateHint')}</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Button
                key={i}
                variant={evalDialog.score === i ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setEvalDialog((d) => ({ ...d, score: i }))}
              >
                {i}
              </Button>
            ))}
          </Box>
          <TextField
            fullWidth
            label={t('effectif.evalComment')}
            multiline
            rows={2}
            value={evalDialog.comment}
            onChange={(e) => setEvalDialog((d) => ({ ...d, comment: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEvalDialog}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSubmitEval} disabled={savingEval}>
            {savingEval ? t('common.saving') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth component="form" onSubmit={handleSubmit}>
        <DialogTitle>{t('effectif.newTechnician')}</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" color="primary" sx={{ mt: 1, mb: 0.5 }}>{t('effectif.accountSection')}</Typography>
          <TextField fullWidth label={t('effectif.email')} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} margin="dense" autoComplete="email" />
          <TextField fullWidth label={t('effectif.password')} type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} margin="dense" helperText={t('effectif.passwordHint')} autoComplete="new-password" />
          <TextField fullWidth label={t('effectif.firstName')} required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} margin="dense" />
          <TextField fullWidth label={t('effectif.lastName')} required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} margin="dense" />
          <TextField fullWidth label={`${t('effectif.hourlyRateOptional')} (${currency}/h)`} type="number" placeholder={t('effectif.optional')} value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} margin="dense" inputProps={{ min: 0, step: 0.01 }} />
          <Typography variant="subtitle2" color="primary" sx={{ mt: 2, mb: 0.5 }}>{t('effectif.personalSection')}</Typography>
          <TextField fullWidth label={t('effectif.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} margin="dense" />
          <TextField fullWidth label={t('effectif.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} margin="dense" />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField fullWidth label={t('effectif.city')} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} margin="dense" />
            <TextField label={t('effectif.postalCode')} value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} margin="dense" sx={{ width: 120 }} />
          </Box>
          <TextField fullWidth label={t('effectif.employeeNumber')} value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} margin="dense" placeholder={t('effectif.optional')} />
          <Typography variant="subtitle2" color="primary" sx={{ mt: 2, mb: 0.5 }}>{t('effectif.technicalSection')}</Typography>
          <TextField fullWidth label={t('effectif.jobTitle')} value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} margin="dense" />
          <TextField fullWidth label={t('effectif.department')} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} margin="dense" />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField fullWidth label={t('effectif.hireDate')} type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} margin="dense" InputLabelProps={{ shrink: true }} />
            <TextField fullWidth label={t('effectif.contractType')} value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })} margin="dense" placeholder={t('effectif.contractTypePlaceholder')} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t('common.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={saving}>{saving ? t('effectif.creatingButton') : t('effectif.createButton')}</Button>
        </DialogActions>
      </Dialog>

      <Grid container spacing={2}>
        {list.length === 0 ? (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography color="text.secondary">{t('effectif.noTechniciansMessage')}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          list.map((tech) => (
            <Grid item xs={12} sm={6} md={4} key={tech.id}>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s',
                  '&:hover': { boxShadow: 4 }
                }}
                onClick={() => navigate(`/app/technicians/${tech.id}`)}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography variant="h6" fontWeight={600}>{tech.first_name} {tech.last_name}</Typography>
                    <Chip label={roleLabel(tech.role_name)} size="small" color="primary" variant="outlined" />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{tech.email}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    {renderStars(tech.avg_score)}
                    <Typography variant="body2" fontWeight={600}>
                      {tech.avg_score != null ? `${tech.avg_score}/5` : '—'} ({tech.evaluation_count} {t('effectif.evaluationsShort')})
                    </Typography>
                    {canAdd && (
                      <Button size="small" startIcon={<RateReview />} onClick={(e) => openEvalDialog(tech, e)} sx={{ ml: 0.5 }}>
                        {t('effectif.evaluate')}
                      </Button>
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('effectif.rateLabel')} : {tech.hourly_rate != null ? `${Number(tech.hourly_rate).toFixed(2)} ${currency}/h` : t('effectif.defaultRate')}
                  </Typography>
                  {tech.workload_count != null && tech.workload_count > 0 && (
                    <Typography variant="caption" color="info.main" display="block" sx={{ mt: 0.5 }}>
                      {t('effectif.workOrdersInProgress', { count: tech.workload_count })}
                    </Typography>
                  )}
                  {(tech.phone || tech.job_title || tech.department || tech.city) && (
                    <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                      {tech.phone && <Typography variant="caption" display="block" color="text.secondary">Tél. {tech.phone}</Typography>}
                      {(tech.job_title || tech.department) && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {[tech.job_title, tech.department].filter(Boolean).join(' · ')}
                        </Typography>
                      )}
                      {(tech.city || tech.address) && (
                        <Typography variant="caption" display="block" color="text.secondary" noWrap title={[tech.address, tech.city, tech.postal_code].filter(Boolean).join(' ')}>
                          {tech.city || tech.address}
                        </Typography>
                      )}
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {tech.competencies?.slice(0, 4).map((c) => (
                      <Chip key={c.competence_id} label={`${c.name} ${c.level}`} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                    ))}
                    {tech.competencies?.length > 4 && <Chip label={`+${tech.competencies.length - 4}`} size="small" />}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>
      {!loading && total > 0 && (
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 20, 50]}
          labelRowsPerPage={t('effectif.rowsPerPage')}
          sx={{ mt: 2 }}
        />
      )}
    </Box>
  );
}

export default TechnicianList;
