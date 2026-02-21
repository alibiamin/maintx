import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  CircularProgress,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  LinearProgress
} from '@mui/material';
import { ArrowBack, PlayArrow, Stop, PersonSearch, Star, Schedule, Checklist, Inventory } from '@mui/icons-material';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSnackbar } from '../../context/SnackbarContext';

const statusLabels = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminé (clôturé)',
  cancelled: 'Annulé',
  deferred: 'Reporté'
};
const statusColors = { pending: 'warning', in_progress: 'info', completed: 'success', cancelled: 'default', deferred: 'default' };

export default function WorkOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestedList, setSuggestedList] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [planChecklists, setPlanChecklists] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const canEdit = ['administrateur', 'responsable_maintenance', 'technicien'].includes(user?.role);
  const canClose = ['administrateur', 'responsable_maintenance'].includes(user?.role);

  const loadOrder = () => {
    if (id === 'new') return;
    api.get(`/work-orders/${id}`).then(r => setOrder(r.data)).catch(() => navigate('/work-orders'));
  };

  useEffect(() => {
    if (id === 'new') return;
    Promise.all([
      api.get(`/work-orders/${id}`),
      api.get('/users/assignable').then(r => r.data).catch(() => [])
    ]).then(([wo, u]) => {
      setOrder(wo.data);
      setUsers(u);
    }).catch(() => navigate('/work-orders')).finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => {
    if (!order?.maintenancePlanId) return;
    api.get('/checklists', { params: { maintenance_plan_id: order.maintenancePlanId } })
      .then(r => setPlanChecklists(r.data || []))
      .catch(() => setPlanChecklists([]));
  }, [order?.maintenancePlanId]);

  useEffect(() => {
    if (!order?.id) return;
    api.get('/stock/movements', { params: { work_order_id: order.id } })
      .then(r => setStockMovements(r.data || []))
      .catch(() => setStockMovements([]));
  }, [order?.id]);

  const handleStatusChange = (newStatus) => {
    if (!canEdit || !order?.id) return;
    setActionLoading(true);
    api.put(`/work-orders/${order.id}`, { ...order, status: newStatus })
      .then(r => { setOrder(r.data); snackbar.showSuccess('Statut mis à jour'); })
      .catch(err => { snackbar.showError(err.response?.data?.error || 'Erreur'); })
      .finally(() => setActionLoading(false));
  };

  const handleAssign = (userId) => {
    if (!canEdit || !order?.id) return;
    api.put(`/work-orders/${order.id}`, { assignedTo: userId || null })
      .then(r => { setOrder(r.data); setSuggestOpen(false); snackbar.showSuccess('Technicien affecté'); })
      .catch(() => snackbar.showError('Erreur'));
  };

  const loadSuggestions = () => {
    if (!order?.id) return;
    setSuggestLoading(true);
    setSuggestOpen(true);
    api.get('/technicians/suggest-assignment', { params: { workOrderId: order.id } })
      .then(r => setSuggestedList(r.data || []))
      .catch(() => setSuggestedList([]))
      .finally(() => setSuggestLoading(false));
  };

  const handleStartWork = () => {
    if (!canEdit || !order?.id || order.status !== 'pending') return;
    setActionLoading(true);
    const now = new Date().toISOString();
    api.put(`/work-orders/${order.id}`, { ...order, status: 'in_progress', actualStart: now })
      .then(r => { setOrder(r.data); snackbar.showSuccess('Travail démarré'); })
      .catch(() => snackbar.showError('Erreur'))
      .finally(() => setActionLoading(false));
  };

  const handleMarkEnd = () => {
    if (!canEdit || !order?.id || order.status !== 'in_progress') return;
    setActionLoading(true);
    const now = new Date().toISOString();
    api.put(`/work-orders/${order.id}`, { ...order, actualEnd: now })
      .then(r => { setOrder(r.data); snackbar.showSuccess('Fin du travail enregistrée. Un responsable ou administrateur clôturera l\'OT.'); })
      .catch(() => snackbar.showError('Erreur'))
      .finally(() => setActionLoading(false));
  };

  if (id === 'new') return <Navigate to="/creation" replace />;
  if (loading || !order) return <Box p={4}><CircularProgress /></Box>;

  const statusOptions = [
    { value: 'pending', label: statusLabels.pending },
    { value: 'in_progress', label: statusLabels.in_progress },
    ...(canClose ? [{ value: 'completed', label: statusLabels.completed }] : []),
    { value: 'cancelled', label: statusLabels.cancelled },
    { value: 'deferred', label: statusLabels.deferred }
  ];

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/work-orders')} sx={{ mb: 2 }}>Retour</Button>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
            <Box>
              <Typography variant="h5">{order.number}</Typography>
              <Typography variant="h6">{order.title}</Typography>
              <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label={statusLabels[order.status] || order.status} color={statusColors[order.status]} size="small" />
                <Chip label={order.priority} size="small" variant="outlined" />
                {order.typeName && <Chip label={order.typeName} size="small" variant="outlined" />}
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
              {canEdit && (
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Statut</InputLabel>
                  <Select
                    value={order.status}
                    label="Statut"
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={actionLoading}
                  >
                    {statusOptions.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              {canEdit && order.status === 'pending' && (
                <Button variant="contained" startIcon={<PlayArrow />} onClick={handleStartWork} disabled={actionLoading} size="small">
                  Démarrer le travail
                </Button>
              )}
              {canEdit && order.status === 'in_progress' && (
                <Button variant="outlined" color="primary" startIcon={<Stop />} onClick={handleMarkEnd} disabled={actionLoading} size="small">
                  Marquer la fin du travail
                </Button>
              )}
              {canEdit && !canClose && order.status === 'in_progress' && order.actualEnd && (
                <Alert severity="info" sx={{ mt: 1 }}>En attente de clôture par un responsable ou administrateur.</Alert>
              )}
            </Box>
          </Box>
          {order.description && (
            <Typography sx={{ mt: 2 }}>{order.description}</Typography>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Équipement</Typography>
              <Typography>{order.equipmentName || '-'}</Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Technicien assigné</Typography>
              {canEdit && users.length ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Select size="small" value={order.assignedTo || ''} onChange={(e) => handleAssign(e.target.value || null)} sx={{ minWidth: 180 }}>
                    <MenuItem value="">Non assigné</MenuItem>
                    {users.filter(u => u.role_name === 'technicien' || u.role_name === 'responsable_maintenance').map(u => (
                      <MenuItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</MenuItem>
                    ))}
                  </Select>
                  <Button size="small" variant="outlined" startIcon={<PersonSearch />} onClick={loadSuggestions}>
                    Suggérer techniciens
                  </Button>
                </Box>
              ) : (
                <Typography>{order.assignedName || '-'}</Typography>
              )}
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Date de création</Typography>
              <Typography>{new Date(order.createdAt).toLocaleString('fr-FR')}</Typography>
            </Grid>
            {order.maintenancePlanId && (
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">Plan de maintenance</Typography>
                <Typography component="span">
                  <Button size="small" startIcon={<Schedule />} onClick={() => navigate('/maintenance-plans')}>
                    {order.maintenancePlanName || `Plan #${order.maintenancePlanId}`}
                  </Button>
                </Typography>
              </Grid>
            )}
            {(order.actualStart || order.actualEnd) && (
              <>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">Début d'intervention</Typography>
                  <Typography>{order.actualStart ? new Date(order.actualStart).toLocaleString('fr-FR') : '-'}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">Fin d'intervention</Typography>
                  <Typography>{order.actualEnd ? new Date(order.actualEnd).toLocaleString('fr-FR') : '-'}</Typography>
                </Grid>
              </>
            )}
          </Grid>
        </CardContent>
      </Card>

      {order.maintenancePlanId && planChecklists.length > 0 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Checklist /> Checklists du plan
            </Typography>
            <List dense disablePadding>
              {planChecklists.map((c) => (
                <ListItem key={c.id} disablePadding secondaryAction={
                  <Button size="small" variant="outlined" onClick={() => navigate('/checklists', { state: { executeChecklistId: c.id, workOrderId: order.id } })}>
                    Exécuter
                  </Button>
                }>
                  <ListItemText primary={c.name} secondary={c.description} />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {stockMovements.length > 0 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Inventory /> Sorties stock liées à cet OT
            </Typography>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& th, & td': { borderBottom: 1, borderColor: 'divider', py: 1, textAlign: 'left' } }}>
              <thead>
                <tr>
                  <th>Pièce</th>
                  <th>Quantité</th>
                  <th>Date</th>
                  <th>Référence</th>
                </tr>
              </thead>
              <tbody>
                {stockMovements.map((m) => (
                  <tr key={m.id}>
                    <td>{m.partName || m.part_code || '-'}</td>
                    <td>{Math.abs(m.quantity)}</td>
                    <td>{m.created_at ? new Date(m.created_at).toLocaleString('fr-FR') : '-'}</td>
                    <td>{m.reference || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </Box>
          </CardContent>
        </Card>
      )}

      <Dialog open={suggestOpen} onClose={() => setSuggestOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Suggestion d'affectation</DialogTitle>
        <DialogContent>
          {suggestLoading ? (
            <Box p={2}><CircularProgress /></Box>
          ) : suggestedList.length === 0 ? (
            <Typography color="text.secondary">Aucun technicien ou aucune règle d'affectation (type ↔ compétence). Configurez les compétences et les règles dans Techniciens.</Typography>
          ) : (
            <List dense>
              {suggestedList.map((t) => (
                <ListItem
                  key={t.id}
                  secondaryAction={
                    <Button size="small" variant="contained" onClick={() => handleAssign(t.id)}>
                      Affecter
                    </Button>
                  }
                  disablePadding
                  sx={{ py: 0.5 }}
                >
                  <ListItemButton onClick={() => handleAssign(t.id)}>
                    <ListItemText
                      primary={`${t.first_name} ${t.last_name}`}
                      secondary={
                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Chip size="small" label={`Score ${t.suggestion_score}%`} color="primary" variant="outlined" />
                          {t.match_score != null && <Typography variant="caption">Adéquation {t.match_score}%</Typography>}
                          {t.avg_evaluation != null && <Typography variant="caption"><Star sx={{ fontSize: 14, verticalAlign: 'middle' }} /> {t.avg_evaluation}/5</Typography>}
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuggestOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
