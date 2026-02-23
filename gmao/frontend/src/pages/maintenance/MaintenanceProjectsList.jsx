import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Button,
  CircularProgress,
  Typography,
  Tooltip,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';

const APP_BASE = '/app';
const STATUS_LABELS = { draft: 'Brouillon', active: 'Actif', completed: 'Terminé', cancelled: 'Annulé' };
const CAN_CREATE_ROLES = ['administrateur', 'responsable_maintenance'];

export default function MaintenanceProjectsList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const currency = useCurrency();
  const canCreate = CAN_CREATE_ROLES.includes(user?.role ?? '');

  const load = () => {
    setLoading(true);
    setProjects([]);
    api
      .get('/maintenance-projects')
      .then((res) => {
        const raw = res.data;
        const arr = Array.isArray(raw) ? raw : (raw?.data ?? []);
        const byId = new Map();
        arr.forEach((p) => { if (p && p.id != null && !byId.has(p.id)) byId.set(p.id, p); });
        setProjects([...byId.values()]);
      })
      .catch(() => {
        snackbar.showError('Erreur chargement des projets');
        setProjects([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    if (!canCreate) return;
    navigate(`${APP_BASE}/maintenance-projects/new`);
  };

  const openDetail = (id) => {
    navigate(`${APP_BASE}/maintenance-projects/${id}`);
  };

  const button = (
    <Button type="button" variant="contained" startIcon={<Add />} disabled={!canCreate} onClick={openNew}>
      Nouveau projet
    </Button>
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={600}>Projets de maintenance</Typography>
          <Typography variant="body2" color="text.secondary">Regroupement d'OT, budget et suivi</Typography>
        </Box>
        {canCreate ? button : (
          <Tooltip title="Réservé aux Administrateurs et Responsables maintenance">
            <span>{button}</span>
          </Tooltip>
        )}
      </Box>

      <Card>
        {loading ? (
          <Box p={4} display="flex" justifyContent="center">
            <CircularProgress />
          </Box>
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
                    <Typography color="text.secondary">
                      Aucun projet. Créez-en un pour regrouper des OT et suivre un budget.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((p) => (
                  <TableRow
                    key={p.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => openDetail(p.id)}
                  >
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.siteName || '—'}</TableCell>
                    <TableCell>
                      {p.startDate || p.endDate
                        ? [p.startDate && new Date(p.startDate).toLocaleDateString('fr-FR'), p.endDate && new Date(p.endDate).toLocaleDateString('fr-FR')]
                            .filter(Boolean)
                            .join(' → ')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={STATUS_LABELS[p.status] || p.status}
                        size="small"
                        color={p.status === 'active' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {p.budgetAmount != null ? `${Number(p.budgetAmount).toLocaleString('fr-FR')} ${currency}` : '—'}
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Button size="small" variant="outlined" onClick={() => openDetail(p.id)}>
                        Voir
                      </Button>
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
