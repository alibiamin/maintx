import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { Search, Warning, PlayArrow, Add } from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';

export default function MaintenancePlansDue() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [executingId, setExecutingId] = useState(null);
  const [executeDialogPlan, setExecuteDialogPlan] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [executeWoId, setExecuteWoId] = useState('');
  const navigate = useNavigate();
  const snackbar = useSnackbar();

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const res = await api.get('/maintenance-plans/due');
      setPlans(res.data || []);
    } catch (error) {
      snackbar.showError('Erreur chargement');
    } finally {
      setLoading(false);
    }
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

  const handleExecuteConfirm = async () => {
    if (!executeDialogPlan) return;
    const planId = executeDialogPlan.id;
    setExecutingId(planId);
    setExecuteDialogPlan(null);
    try {
      await api.post(`/maintenance-plans/${planId}/execute`, {
        work_order_id: executeWoId ? parseInt(executeWoId, 10) : undefined
      });
      snackbar.showSuccess('Plan exécuté. Prochaine échéance mise à jour.');
      loadPlans();
    } catch (error) {
      snackbar.showError(error.response?.data?.error || 'Erreur lors de l\'exécution');
    } finally {
      setExecutingId(null);
    }
  };

  const filteredPlans = plans.filter(
    (p) =>
      !search ||
      (p.equipment_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Échéances de maintenance
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Plans à exécuter dans les 7 prochains jours
          </Typography>
        </Box>
        <TextField
          size="small"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : filteredPlans.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucune échéance à venir
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Équipement</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Prochaine échéance</TableCell>
                  <TableCell>Jours restants</TableCell>
                  <TableCell>Fréquence</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPlans.map((plan) => {
                  const due = plan.next_due_date ? new Date(plan.next_due_date) : null;
                  const daysRemaining = due
                    ? Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24))
                    : null;
                  const isOverdue = daysRemaining != null && daysRemaining < 0;
                  return (
                    <TableRow key={plan.id}>
                      <TableCell>{plan.equipment_name || plan.equipment_code || '-'}</TableCell>
                      <TableCell>{plan.name}</TableCell>
                      <TableCell>
                        {due ? due.toLocaleDateString('fr-FR') : '-'}
                      </TableCell>
                      <TableCell>
                        {daysRemaining == null ? (
                          '-'
                        ) : isOverdue ? (
                          <Box display="flex" alignItems="center" gap={1}>
                            <Warning color="error" fontSize="small" />
                            <Typography color="error">
                              {Math.abs(daysRemaining)} j. retard
                            </Typography>
                          </Box>
                        ) : (
                          <Typography>{daysRemaining} j.</Typography>
                        )}
                      </TableCell>
                      <TableCell>Tous les {plan.frequency_days} j.</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<Add />}
                          onClick={() => navigate('/app/work-orders/new', { state: { maintenancePlanId: plan.id, equipmentId: plan.equipment_id, title: plan.name } })}
                        >
                          Créer un OT
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<PlayArrow />}
                          onClick={() => openExecuteDialog(plan)}
                          disabled={executingId === plan.id}
                          sx={{ ml: 1 }}
                        >
                          {executingId === plan.id ? 'Exécution...' : 'Exécuter'}
                        </Button>
                        <Button
                          size="small"
                          sx={{ ml: 1 }}
                          onClick={() => navigate('/app/maintenance-plans')}
                        >
                          Voir plan
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
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
    </Box>
  );
}
