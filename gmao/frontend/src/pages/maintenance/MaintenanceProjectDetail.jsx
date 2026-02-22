import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Chip, Button, CircularProgress,
  Table, TableBody, TableCell, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem, Alert
} from '@mui/material';
import { ArrowBack, Edit, Add, LinkOff } from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';
import { useAuth } from '../../context/AuthContext';

const STATUS_LABELS = { draft: 'Brouillon', active: 'Actif', completed: 'Terminé', cancelled: 'Annulé' };

export default function MaintenanceProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [availableWorkOrders, setAvailableWorkOrders] = useState([]);
  const [linkWoId, setLinkWoId] = useState('');
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const canEdit = ['administrateur', 'responsable_maintenance'].includes(user?.role);

  const load = () => {
    if (!id || id === 'new' || id === 'undefined') return;
    setLoading(true);
    api.get(`/maintenance-projects/${id}`)
      .then((r) => setProject(r.data))
      .catch(() => snackbar.showError('Projet non trouvé'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (id === 'undefined' || id === 'new') {
      navigate('/maintenance-projects', { replace: true });
      return;
    }
    load();
  }, [id, navigate]);

  const openLinkDialog = () => {
    setLinkWoId('');
    api.get('/work-orders?limit=500')
      .then((r) => {
        const list = r.data?.data ?? r.data;
        const arr = Array.isArray(list) ? list : [];
        const linkedIds = (project?.workOrders || []).map((wo) => wo.id);
        setAvailableWorkOrders(arr.filter((wo) => !linkedIds.includes(wo.id)));
      })
      .catch(() => setAvailableWorkOrders([]));
    setLinkDialogOpen(true);
  };

  const handleLink = () => {
    if (!linkWoId) return;
    setLinkSubmitting(true);
    api.post(`/maintenance-projects/${id}/link-work-order`, { workOrderId: parseInt(linkWoId, 10) })
      .then(() => { snackbar.showSuccess('OT rattaché'); setLinkDialogOpen(false); load(); })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setLinkSubmitting(false));
  };

  const handleUnlink = (workOrderId) => {
    api.post(`/maintenance-projects/${id}/unlink-work-order`, { workOrderId })
      .then(() => { snackbar.showSuccess('OT détaché'); load(); })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'));
  };

  if (loading && !project) {
    return (
      <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
    );
  }
  if (!project) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/maintenance-projects')}>Retour</Button>
        <Alert severity="error" sx={{ mt: 2 }}>Projet non trouvé.</Alert>
      </Box>
    );
  }

  const budget = Number(project.budgetAmount) || 0;
  const totalCost = Number(project.totalCost) || 0;
  const overBudget = budget > 0 && totalCost > budget;

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/maintenance-projects')}>Retour</Button>
        {canEdit && (
          <Button startIcon={<Edit />} variant="outlined" onClick={() => navigate(`/maintenance-projects/${id}/edit`)}>Modifier</Button>
        )}
      </Box>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={600}>{project.name}</Typography>
          {project.description && <Typography color="text.secondary" sx={{ mt: 1 }}>{project.description}</Typography>}
          <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
            <Chip label={STATUS_LABELS[project.status] || project.status} size="small" color={project.status === 'active' ? 'success' : 'default'} />
            {project.siteName && <Typography variant="body2">Site : {project.siteName}</Typography>}
            {project.startDate && <Typography variant="body2">Début : {new Date(project.startDate).toLocaleDateString('fr-FR')}</Typography>}
            {project.endDate && <Typography variant="body2">Fin : {new Date(project.endDate).toLocaleDateString('fr-FR')}</Typography>}
          </Box>
          <Box sx={{ mt: 2, display: 'flex', gap: 3 }}>
            <Typography fontWeight={600}>Budget : {budget.toLocaleString('fr-FR')} €</Typography>
            <Typography fontWeight={600} color={overBudget ? 'error.main' : 'text.primary'}>
              Coût réel : {totalCost.toLocaleString('fr-FR')} €
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
              <Button size="small" startIcon={<Add />} onClick={openLinkDialog}>Rattacher un OT</Button>
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
              {(!project.workOrders || project.workOrders.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 8 : 7}>Aucun OT rattaché. Utilisez « Rattacher un OT » pour en ajouter.</TableCell>
                </TableRow>
              ) : (
                project.workOrders.map((wo) => (
                  <TableRow key={wo.id}>
                    <TableCell>
                      <Button size="small" onClick={() => navigate(`/work-orders/${wo.id}`)}>{wo.number}</Button>
                    </TableCell>
                    <TableCell>{wo.title}</TableCell>
                    <TableCell>{wo.equipmentCode ? `${wo.equipmentCode} ${wo.equipmentName || ''}`.trim() : '—'}</TableCell>
                    <TableCell><Chip label={wo.status} size="small" /></TableCell>
                    <TableCell align="right">{(wo.laborCost ?? 0).toLocaleString('fr-FR')} €</TableCell>
                    <TableCell align="right">{(wo.partsCost ?? 0).toLocaleString('fr-FR')} €</TableCell>
                    <TableCell align="right">{(wo.totalCost ?? 0).toLocaleString('fr-FR')} €</TableCell>
                    {canEdit && (
                      <TableCell align="right">
                        <Button size="small" color="error" startIcon={<LinkOff />} onClick={() => handleUnlink(wo.id)}>Détacher</Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Rattacher un ordre de travail</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>OT</InputLabel>
            <Select value={linkWoId} label="OT" onChange={(e) => setLinkWoId(e.target.value)}>
              {availableWorkOrders.map((wo) => (
                <MenuItem key={wo.id} value={String(wo.id)}>{wo.number} — {wo.title}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {availableWorkOrders.length === 0 && <Typography color="text.secondary" sx={{ mt: 1 }}>Aucun OT disponible (tous sont déjà rattachés ou liste vide).</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleLink} disabled={!linkWoId || linkSubmitting}>Rattacher</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
