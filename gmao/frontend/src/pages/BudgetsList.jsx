import React, { useEffect, useState } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableHead, TableRow,
  Button, CircularProgress, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem,
  alpha
} from '@mui/material';
import { Add, TrendingUp } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useSnackbar } from '../context/SnackbarContext';
import { useAuth } from '../context/AuthContext';

export default function BudgetsList() {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [sites, setSites] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', siteId: '', projectId: '', year: new Date().getFullYear(), amount: 0, currency: 'EUR', notes: '' });
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const canEdit = ['administrateur', 'responsable_maintenance'].includes(user?.role);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/budgets').then((r) => setList(Array.isArray(r.data) ? r.data : [])),
      api.get('/sites').then((r) => setSites(Array.isArray(r.data) ? r.data : [])).catch(() => {}),
      api.get('/maintenance-projects').then((r) => setProjects(Array.isArray(r.data) ? r.data : [])).catch(() => {})
    ]).catch(() => snackbar.showError('Erreur chargement')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditingId(null); setForm({ name: '', siteId: '', projectId: '', year: new Date().getFullYear(), amount: 0, currency: 'EUR', notes: '' }); setDialogOpen(true); };
  const openEdit = (row) => { setEditingId(row.id); setForm({ name: row.name || '', siteId: row.site_id || '', projectId: row.project_id || '', year: row.year || new Date().getFullYear(), amount: row.amount || 0, currency: row.currency || 'EUR', notes: row.notes || '' }); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.name.trim()) { snackbar.showError('Nom requis'); return; }
    setSaving(true);
    const payload = { name: form.name, siteId: form.siteId || null, projectId: form.projectId || null, year: form.year, amount: form.amount, currency: form.currency, notes: form.notes };
    (editingId ? api.put(`/budgets/${editingId}`, payload) : api.post('/budgets', payload))
      .then(() => { snackbar.showSuccess(editingId ? 'Mis à jour' : 'Créé'); setDialogOpen(false); load(); })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (id) => {
    if (!window.confirm('Supprimer ce budget ?')) return;
    api.delete(`/budgets/${id}`).then(() => { snackbar.showSuccess('Supprimé'); load(); }).catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'));
  };

  const formatAmount = (val, currency) => (Number(val) ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' ' + (currency || 'EUR');

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Typography variant="h5" fontWeight={700}>{t('item.budgets_list')}</Typography>
        {canEdit && <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Nouveau</Button>}
      </Box>
      <Card>
        {loading ? <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box> : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nom</TableCell>
                <TableCell>Site</TableCell>
                <TableCell>Projet</TableCell>
                <TableCell>Année</TableCell>
                <TableCell>Montant prévu</TableCell>
                <TableCell>Budget actuel</TableCell>
                <TableCell>Devise</TableCell>
                {canEdit && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={canEdit ? 8 : 7} align="center"><Typography color="text.secondary">Aucun budget. Cliquez sur &quot;Nouveau&quot; pour en créer un.</Typography></TableCell></TableRow>
              ) : (
                list.map((row) => {
                  const amount = Number(row.amount) || 0;
                  const current = Number(row.current_cost) ?? 0;
                  const currency = row.currency || 'EUR';
                  const pct = amount > 0 ? Math.min(100, (current / amount) * 100) : 0;
                  const isOver = amount > 0 && current > amount;
                  return (
                    <React.Fragment key={row.id}>
                      <TableRow hover>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.site_id ? <Link to="/app/sites" style={{ color: 'inherit', fontWeight: 500 }}>{row.site_name || '—'}</Link> : (row.site_name || '—')}</TableCell>
                        <TableCell>{row.project_id ? <Link to={`/app/maintenance-projects/${row.project_id}`} style={{ color: 'inherit', fontWeight: 500 }}>{row.project_name || '—'}</Link> : (row.project_name || '—')}</TableCell>
                        <TableCell>{row.year}</TableCell>
                        <TableCell>{formatAmount(row.amount, currency)}</TableCell>
                        <TableCell>{row.project_id ? formatAmount(row.current_cost, currency) : '—'}</TableCell>
                        <TableCell>{currency}</TableCell>
                        {canEdit && (
                          <TableCell align="right">
                            <Button size="small" onClick={() => openEdit(row)}>Modifier</Button>
                            <Button size="small" color="error" onClick={() => handleDelete(row.id)}>Supprimer</Button>
                          </TableCell>
                        )}
                      </TableRow>
                      <TableRow sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.03) }}>
                        <TableCell colSpan={canEdit ? 8 : 7} sx={{ py: 1.5, px: 3, borderBottom: 1, borderColor: 'divider' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                            <TrendingUp sx={{ fontSize: 20, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">Avancement par rapport au prévision :</Typography>
                            <Box sx={{ flex: 1, minWidth: 200, maxWidth: 400, height: 24, borderRadius: 1, overflow: 'hidden', display: 'flex', bgcolor: (theme) => alpha(theme.palette.divider, 0.3) }}>
                              <Box
                                sx={{
                                  width: `${pct}%`,
                                  height: '100%',
                                  bgcolor: isOver ? 'error.main' : 'primary.main',
                                  transition: 'width 0.3s ease'
                                }}
                              />
                            </Box>
                            <Typography variant="caption" fontWeight={600}>
                              {row.project_id
                                ? `${formatAmount(current, currency)} / ${formatAmount(amount, currency)}${amount > 0 ? ` (${(current / amount * 100).toFixed(0)} %)` : ''}`
                                : 'Associer un projet pour suivre les coûts OT'}
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </Card>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Modifier le budget' : 'Nouveau budget'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Nom" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} margin="dense" />
          <FormControl fullWidth margin="dense">
            <InputLabel>Site</InputLabel>
            <Select value={form.siteId} label="Site" onChange={(e) => setForm({ ...form, siteId: e.target.value })}>
              <MenuItem value="">—</MenuItem>
              {sites.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>Projet (optionnel)</InputLabel>
            <Select value={form.projectId} label="Projet (optionnel)" onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
              <MenuItem value="">—</MenuItem>
              {projects.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth type="number" label="Année" value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value, 10) || new Date().getFullYear() })} margin="dense" />
          <TextField fullWidth type="number" label="Montant" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} margin="dense" />
          <TextField fullWidth label="Devise" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} margin="dense" />
          <TextField fullWidth label="Notes" multiline value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} margin="dense" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
