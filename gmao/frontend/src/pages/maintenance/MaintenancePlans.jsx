import React, { useEffect, useState } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableHead, TableRow,
  Chip, Button, CircularProgress, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem,
  TextField, FormControlLabel, Checkbox
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { PlayArrow, Add, Edit } from '@mui/icons-material';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSnackbar } from '../../context/SnackbarContext';

export default function MaintenancePlans() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [executingId, setExecutingId] = useState(null);
  const [executeDialogPlan, setExecuteDialogPlan] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [executeWoId, setExecuteWoId] = useState('');
  const [editPlan, setEditPlan] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', frequencyDays: '30', isActive: true, procedureId: '' });
  const [procedures, setProcedures] = useState([]);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const canExecute = ['administrateur', 'responsable_maintenance', 'technicien'].includes(user?.role);
  const canCreate = ['administrateur', 'responsable_maintenance'].includes(user?.role);

  const load = () => {
    setLoading(true);
    api.get('/maintenance-plans')
      .then((r) => {
        const raw = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
        const byKey = new Map();
        raw.forEach((p) => {
          if (!p) return;
          const key = `${p.equipment_id ?? ''}|${(p.name || '').trim()}`;
          if (!byKey.has(key)) byKey.set(key, p);
        });
        setPlans([...byKey.values()]);
      })
      .catch(() => snackbar.showError('Erreur chargement'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    api.get('/procedures').then(r => setProcedures(r.data || [])).catch(() => setProcedures([]));
  }, []);

  const openEditDialog = (plan) => {
    setEditPlan(plan);
    setEditForm({
      name: plan.name || '',
      description: plan.description || '',
      frequencyDays: String(plan.frequency_days ?? 30),
      isActive: !!plan.is_active,
      procedureId: plan.procedure_id != null ? String(plan.procedure_id) : ''
    });
  };

  const handleEditSave = () => {
    if (!editPlan) return;
    setEditSubmitting(true);
    api.put(`/maintenance-plans/${editPlan.id}`, {
      name: editForm.name,
      description: editForm.description || undefined,
      frequencyDays: parseInt(editForm.frequencyDays, 10) || 30,
      isActive: editForm.isActive,
      procedureId: editForm.procedureId ? parseInt(editForm.procedureId, 10) : null
    })
      .then(() => { snackbar.showSuccess('Plan mis à jour.'); setEditPlan(null); load(); })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur lors de la mise à jour'))
      .finally(() => setEditSubmitting(false));
  };

  const openExecuteDialog = (plan) => {
    setExecuteDialogPlan(plan);
    setExecuteWoId('');
    api.get('/work-orders')
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : [];
        setWorkOrders(list.filter((wo) => wo.status === 'pending' || wo.status === 'in_progress'));
      })
      .catch(() => setWorkOrders([]));
  };

  const handleExecuteConfirm = () => {
    if (!executeDialogPlan) return;
    const planId = executeDialogPlan.id;
    setExecutingId(planId);
    setExecuteDialogPlan(null);
    api.post(`/maintenance-plans/${planId}/execute`, { work_order_id: executeWoId ? parseInt(executeWoId, 10) : undefined })
      .then(() => { snackbar.showSuccess('Plan exécuté. Prochaine échéance mise à jour.'); load(); })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur lors de l\'exécution'))
      .finally(() => setExecutingId(null));
  };

  const isDue = (date) => {
    if (!date) return false;
    return new Date(date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <h2 style={{ margin: 0 }}>Maintenance préventive</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>Plans de maintenance et calendrier</p>
        </Box>
        {canCreate && (
          <Typography variant="body2" color="text.secondary">Création dans le menu Création</Typography>
        )}
      </Box>

      <Card>
        {loading ? (
          <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Équipement</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Fréquence</TableCell>
                <TableCell>Prochaine échéance</TableCell>
                <TableCell>Statut</TableCell>
                {(canExecute || canCreate) && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>{plan.equipment_name} <Typography variant="caption" color="text.secondary">({plan.equipment_code})</Typography></TableCell>
                  <TableCell>{plan.name}</TableCell>
                  <TableCell>Tous les {plan.frequency_days} jours</TableCell>
                  <TableCell>
                    {new Date(plan.next_due_date).toLocaleDateString('fr-FR')}
                    {isDue(plan.next_due_date) && <Chip label="À faire" color="warning" size="small" sx={{ ml: 1 }} />}
                  </TableCell>
                  <TableCell><Chip label={plan.is_active ? 'Actif' : 'Inactif'} size="small" color={plan.is_active ? 'success' : 'default'} /></TableCell>
                  {(canExecute || canCreate) && (
                    <TableCell align="right">
                      {canCreate && (
                        <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => openEditDialog(plan)} sx={{ mr: 1 }}>
                          Modifier
                        </Button>
                      )}
                      {canExecute && (
                        <>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Add />}
                            onClick={() => navigate('/app/work-orders/new', { state: { maintenancePlanId: plan.id, equipmentId: plan.equipment_id, title: plan.name } })}
                            sx={{ mr: 1 }}
                          >
                            Créer un OT
                          </Button>
                          <Button
                            size="small"
                            startIcon={<PlayArrow />}
                            onClick={() => openExecuteDialog(plan)}
                            disabled={executingId === plan.id}
                          >
                            {executingId === plan.id ? 'Exécution...' : 'Exécuter'}
                          </Button>
                        </>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && plans.length === 0 && (
          <Box p={4} textAlign="center" color="text.secondary">Aucun plan de maintenance</Box>
        )}
      </Card>

      <Dialog open={!!executeDialogPlan} onClose={() => setExecuteDialogPlan(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Exécuter le plan</DialogTitle>
        <DialogContent>
          {executeDialogPlan && (
            <Typography sx={{ mb: 2 }}>{executeDialogPlan.name} — {executeDialogPlan.equipment_code}</Typography>
          )}
          <FormControl fullWidth size="small">
            <InputLabel>OT lié (optionnel)</InputLabel>
            <Select value={executeWoId} label="OT lié (optionnel)" onChange={(e) => setExecuteWoId(e.target.value)}>
              <MenuItem value="">Aucun</MenuItem>
              {workOrders.map((wo) => (
                <MenuItem key={wo.id} value={wo.id}>{wo.number} — {wo.title}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExecuteDialogPlan(null)}>Annuler</Button>
          <Button variant="contained" onClick={handleExecuteConfirm}>Exécuter</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editPlan} onClose={() => setEditPlan(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Modifier le plan</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {editPlan && (
            <>
              <TextField fullWidth size="small" label="Nom du plan" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              <TextField fullWidth size="small" multiline label="Description" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
              <TextField fullWidth size="small" type="number" label="Fréquence (jours)" value={editForm.frequencyDays} onChange={(e) => setEditForm((f) => ({ ...f, frequencyDays: e.target.value }))} inputProps={{ min: 1 }} />
              <FormControlLabel control={<Checkbox checked={editForm.isActive} onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))} />} label="Plan actif" />
              <FormControl fullWidth size="small">
                <InputLabel>Procédure</InputLabel>
                <Select value={editForm.procedureId} label="Procédure" onChange={(e) => setEditForm((f) => ({ ...f, procedureId: e.target.value }))}>
                  <MenuItem value="">— Aucune —</MenuItem>
                  {procedures.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </Select>
              </FormControl>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditPlan(null)}>Annuler</Button>
          <Button variant="contained" onClick={handleEditSave} disabled={editSubmitting || !editForm.name?.trim()}>
            {editSubmitting ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
