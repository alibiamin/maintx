import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import { ArrowBack, Edit, Add, LinkOff } from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';

const APP_BASE = '/app';
const STATUS_LABELS = { draft: 'Brouillon', active: 'Actif', completed: 'Terminé', cancelled: 'Annulé' };
export default function MaintenanceProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [availableWOs, setAvailableWOs] = useState([]);
  const [linkWoId, setLinkWoId] = useState('');
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkPlanOpen, setLinkPlanOpen] = useState(false);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [linkPlanId, setLinkPlanId] = useState('');
  const [linkPlanSubmitting, setLinkPlanSubmitting] = useState(false);
  const { user, can } = useAuth();
  const snackbar = useSnackbar();
  const currency = useCurrency();
  const canEdit = can('maintenance_projects', 'update');

  const load = () => {
    if (!id || id === 'new' || id === 'undefined') return;
    setLoading(true);
    api
      .get(`/maintenance-projects/${id}`)
      .then((r) => setProject(r.data))
      .catch(() => snackbar.showError('Projet non trouvé'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (id === 'undefined' || id === 'new') {
      navigate(`${APP_BASE}/maintenance-projects`);
      return;
    }
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId) || numId < 1) {
      navigate(`${APP_BASE}/maintenance-projects`);
      return;
    }
    load();
  }, [id, navigate]);

  const openLinkDialog = () => {
    setLinkWoId('');
    api
      .get('/work-orders?limit=500')
      .then((r) => {
        const list = r.data?.data ?? r.data;
        const arr = Array.isArray(list) ? list : [];
        const linkedIds = (project?.workOrders ?? []).map((wo) => wo.id);
        setAvailableWOs(arr.filter((wo) => !linkedIds.includes(wo.id)));
      })
      .catch(() => setAvailableWOs([]));
    setLinkOpen(true);
  };

  const handleLink = () => {
    if (!linkWoId) return;
    setLinkSubmitting(true);
    api
      .post(`/maintenance-projects/${id}/link-work-order`, { workOrderId: parseInt(linkWoId, 10) })
      .then(() => {
        snackbar.showSuccess('OT rattaché');
        setLinkOpen(false);
        load();
      })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setLinkSubmitting(false));
  };

  const handleUnlink = (workOrderId) => {
    api
      .post(`/maintenance-projects/${id}/unlink-work-order`, { workOrderId })
      .then(() => {
        snackbar.showSuccess('OT détaché');
        load();
      })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'));
  };

  const openLinkPlanDialog = () => {
    setLinkPlanId('');
    api
      .get('/maintenance-plans')
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
        const linkedIds = (project?.maintenancePlans ?? []).map((p) => p.id);
        setAvailablePlans(list.filter((p) => !linkedIds.includes(p.id)));
      })
      .catch(() => setAvailablePlans([]));
    setLinkPlanOpen(true);
  };

  const handleLinkPlan = () => {
    if (!linkPlanId) return;
    setLinkPlanSubmitting(true);
    api
      .post(`/maintenance-projects/${id}/link-plan`, { planId: parseInt(linkPlanId, 10) })
      .then(() => {
        snackbar.showSuccess('Plan rattaché');
        setLinkPlanOpen(false);
        load();
      })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setLinkPlanSubmitting(false));
  };

  const handleUnlinkPlan = (planId) => {
    api
      .post(`/maintenance-projects/${id}/unlink-plan`, { planId })
      .then(() => {
        snackbar.showSuccess('Plan détaché');
        load();
      })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'));
  };

  if (loading && !project) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }
  if (!project) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(`${APP_BASE}/maintenance-projects`)}>
          Retour
        </Button>
        <Alert severity="error" sx={{ mt: 2 }}>
          Projet non trouvé.
        </Alert>
      </Box>
    );
  }

  const budget = Number(project.budgetAmount) || 0;
  const totalCost = Number(project.totalCost) || 0;
  const overBudget = budget > 0 && totalCost > budget;
  const workOrders = project.workOrders ?? [];
  const maintenancePlans = project.maintenancePlans ?? [];

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(`${APP_BASE}/maintenance-projects`)}>
          Retour
        </Button>
        {canEdit && (
          <Button startIcon={<Edit />} variant="outlined" onClick={() => navigate(`${APP_BASE}/maintenance-projects/${id}/edit`)}>
            Modifier
          </Button>
        )}
      </Box>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={600}>
            {project.name}
          </Typography>
          {project.description && (
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {project.description}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
            <Chip
              label={STATUS_LABELS[project.status] || project.status}
              size="small"
              color={project.status === 'active' ? 'success' : 'default'}
            />
            {project.siteName && (
              <Typography variant="body2">Site : {project.siteName}</Typography>
            )}
            {project.startDate && (
              <Typography variant="body2">
                Début : {new Date(project.startDate).toLocaleDateString('fr-FR')}
              </Typography>
            )}
            {project.endDate && (
              <Typography variant="body2">
                Fin : {new Date(project.endDate).toLocaleDateString('fr-FR')}
              </Typography>
            )}
          </Box>
          <Box sx={{ mt: 2, display: 'flex', gap: 3, alignItems: 'center' }}>
            <Typography fontWeight={600}>Budget : {budget.toLocaleString('fr-FR')} {currency}</Typography>
            <Typography fontWeight={600} color={overBudget ? 'error.main' : 'text.primary'}>
              Coût réel : {totalCost.toLocaleString('fr-FR')} {currency}
            </Typography>
            {overBudget && <Chip label="Dépassement" color="error" size="small" />}
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Ordres de travail du projet</Typography>
            {canEdit && (
              <Button size="small" startIcon={<Add />} onClick={openLinkDialog}>
                Rattacher un OT
              </Button>
            )}
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>N° OT</TableCell>
                <TableCell>Titre</TableCell>
                <TableCell>Équipement</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell align="right">Coût main d'œuvre</TableCell>
                <TableCell align="right">Coût pièces</TableCell>
                <TableCell align="right">Total</TableCell>
                {canEdit && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {workOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 8 : 7}>
                    Aucun OT rattaché. Utilisez « Rattacher un OT » pour en ajouter.
                  </TableCell>
                </TableRow>
              ) : (
                workOrders.map((wo) => (
                  <TableRow key={wo.id}>
                    <TableCell>
                      <Button size="small" onClick={() => navigate(`${APP_BASE}/work-orders/${wo.id}`)}>
                        {wo.number}
                      </Button>
                    </TableCell>
                    <TableCell>{wo.title}</TableCell>
                    <TableCell>
                      {wo.equipmentCode ? `${wo.equipmentCode} ${wo.equipmentName || ''}`.trim() : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip label={wo.status} size="small" />
                    </TableCell>
                    <TableCell align="right">
                      {(wo.laborCost ?? 0).toLocaleString('fr-FR')} {currency}
                    </TableCell>
                    <TableCell align="right">
                      {(wo.partsCost ?? 0).toLocaleString('fr-FR')} {currency}
                    </TableCell>
                    <TableCell align="right">
                      {(wo.totalCost ?? 0).toLocaleString('fr-FR')} {currency}
                    </TableCell>
                    {canEdit && (
                      <TableCell align="right">
                        <Button
                          size="small"
                          color="error"
                          startIcon={<LinkOff />}
                          onClick={() => handleUnlink(wo.id)}
                        >
                          Détacher
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Plans de maintenance du projet</Typography>
            {canEdit && (
              <Button size="small" startIcon={<Add />} onClick={openLinkPlanDialog}>
                Rattacher un plan
              </Button>
            )}
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Plan</TableCell>
                <TableCell>Équipement</TableCell>
                <TableCell>Prochaine échéance</TableCell>
                <TableCell>Statut</TableCell>
                {canEdit && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {maintenancePlans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 5 : 4}>
                    Aucun plan rattaché. Utilisez « Rattacher un plan » pour en ajouter.
                  </TableCell>
                </TableRow>
              ) : (
                maintenancePlans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>{plan.name}</TableCell>
                    <TableCell>
                      {plan.equipmentCode ? `${plan.equipmentCode} ${plan.equipmentName || ''}`.trim() : '—'}
                    </TableCell>
                    <TableCell>
                      {plan.nextDueDate
                        ? new Date(plan.nextDueDate).toLocaleDateString('fr-FR')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip label={plan.isActive ? 'Actif' : 'Inactif'} size="small" color={plan.isActive ? 'success' : 'default'} />
                    </TableCell>
                    {canEdit && (
                      <TableCell align="right">
                        <Button
                          size="small"
                          color="error"
                          startIcon={<LinkOff />}
                          onClick={() => handleUnlinkPlan(plan.id)}
                        >
                          Détacher
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={linkOpen} onClose={() => setLinkOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Rattacher un ordre de travail</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>OT</InputLabel>
            <Select value={linkWoId} label="OT" onChange={(e) => setLinkWoId(e.target.value)}>
              {availableWOs.map((wo) => (
                <MenuItem key={wo.id} value={String(wo.id)}>
                  {wo.number} — {wo.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {availableWOs.length === 0 && (
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Aucun OT disponible (tous rattachés ou liste vide).
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleLink} disabled={!linkWoId || linkSubmitting}>
            Rattacher
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={linkPlanOpen} onClose={() => setLinkPlanOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Rattacher un plan de maintenance</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>Plan</InputLabel>
            <Select value={linkPlanId} label="Plan" onChange={(e) => setLinkPlanId(e.target.value)}>
              {availablePlans.map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>
                  {p.name} — {p.equipment_code || p.equipmentCode || '—'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {availablePlans.length === 0 && (
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Aucun plan disponible (tous rattachés ou liste vide).
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkPlanOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleLinkPlan} disabled={!linkPlanId || linkPlanSubmitting}>
            Rattacher
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
