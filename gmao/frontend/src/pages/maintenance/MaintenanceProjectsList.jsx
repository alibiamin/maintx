import React, { useEffect, useState } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableHead, TableRow,
  Chip, Button, CircularProgress, Typography, Tooltip
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Add } from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';
import { useAuth } from '../../context/AuthContext';

const STATUS_LABELS = { draft: 'Brouillon', active: 'Actif', completed: 'Terminé', cancelled: 'Annulé' };

export default function MaintenanceProjectsList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const canCreate = ['administrateur', 'responsable_maintenance'].includes(user?.role);

  const load = () => {
    setLoading(true);
    api.get('/maintenance-projects')
      .then((r) => setProjects(Array.isArray(r.data) ? r.data : []))
      .catch(() => snackbar.showError('Erreur chargement'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <h2 style={{ margin: 0 }}>Projets de maintenance</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>Regroupement d'OT, budget et suivi</p>
        </Box>
        <Tooltip title={!canCreate ? 'Droits insuffisants (Administrateur ou Responsable)' : ''}>
          <span>
            <Button
              type="button"
              variant="contained"
              startIcon={<Add />}
              onClick={() => { if (canCreate) navigate('/maintenance-projects/new'); }}
              disabled={!canCreate}
            >
              Nouveau projet
            </Button>
          </span>
        </Tooltip>
      </Box>

      <Card>
        {loading ? (
          <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nom</TableCell>
                <TableCell>Site</TableCell>
                <TableCell>Période</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell align="right">Budget</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary">Aucun projet. Créez-en un pour regrouper des OT et suivre un budget.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((p) => (
                  <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/maintenance-projects/${p.id}`)}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.siteName || '—'}</TableCell>
                    <TableCell>
                      {p.startDate || p.endDate
                        ? [p.startDate && new Date(p.startDate).toLocaleDateString('fr-FR'), p.endDate && new Date(p.endDate).toLocaleDateString('fr-FR')].filter(Boolean).join(' → ')
                        : '—'}
                    </TableCell>
                    <TableCell><Chip label={STATUS_LABELS[p.status] || p.status} size="small" color={p.status === 'active' ? 'success' : p.status === 'completed' ? 'default' : 'default'} /></TableCell>
                    <TableCell align="right">{p.budgetAmount != null ? `${Number(p.budgetAmount).toLocaleString('fr-FR')} €` : '—'}</TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Button size="small" onClick={() => navigate(`/maintenance-projects/${p.id}`)}>Voir</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </Box>
  );
}
