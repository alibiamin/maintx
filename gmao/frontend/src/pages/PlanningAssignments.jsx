import React, { useEffect, useState, useCallback } from 'react';
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
  Chip,
  CircularProgress,
  TextField,
  InputAdornment,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  alpha,
  useTheme
} from '@mui/material';
import { Search, Person, Refresh, OpenInNew, PersonOutline } from '@mui/icons-material';
import api from '../services/api';
import { useTranslation } from 'react-i18next';

const STATUS_FILTER_ALL = 'pending,in_progress,completed';

export default function PlanningAssignments() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending,in_progress');

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/planning/assignments', {
        params: { status: statusFilter }
      });
      setAssignments(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error(error);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const filteredAssignments = assignments.filter(
    (a) =>
      !search ||
      (a.technicianName || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.workOrderTitle || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.workOrderNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.equipmentName || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.equipmentCode || '').toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (hours) => {
    if (hours == null || hours === '') return '—';
    const h = Number(hours);
    if (Number.isNaN(h)) return '—';
    if (h < 1) return `${Math.round(h * 60)} min`;
    return `${Math.round(h * 10) / 10} h`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'info';
      case 'cancelled':
        return 'default';
      default:
        return 'warning';
    }
  };

  const getPriorityColor = (priority) => {
    switch ((priority || '').toLowerCase()) {
      case 'high':
      case 'haute':
        return 'error';
      case 'low':
      case 'basse':
        return 'default';
      default:
        return 'warning';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {t('planning.assignmentsTitle', 'Affectations des techniciens')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('planning.assignmentsSubtitle', 'Répartition des interventions par technicien (assigné principal et opérateurs)')}
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>{t('planning.filterStatus', 'Statut')}</InputLabel>
            <Select
              value={statusFilter}
              label={t('planning.filterStatus', 'Statut')}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="pending,in_progress">{t('planning.filterActive', 'En attente + En cours')}</MenuItem>
              <MenuItem value="pending">{t('status.pending', 'En attente')}</MenuItem>
              <MenuItem value="in_progress">{t('status.in_progress', 'En cours')}</MenuItem>
              <MenuItem value="completed">{t('status.completed', 'Terminé')}</MenuItem>
              <MenuItem value={STATUS_FILTER_ALL}>{t('common.all', 'Tous')}</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title={t('common.refresh')}>
            <IconButton onClick={loadAssignments} disabled={loading} size="small">
              <Refresh />
            </IconButton>
          </Tooltip>
          <TextField
            size="small"
            placeholder={t('common.search', 'Rechercher...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 220 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              )
            }}
          />
        </Box>
      </Box>

      <Card sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={220} p={4}>
              <CircularProgress />
            </Box>
          ) : filteredAssignments.length === 0 ? (
            <Box textAlign="center" py={6} px={2}>
              <Person sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary" variant="body1">
                {assignments.length === 0
                  ? t('planning.noAssignments', 'Aucune affectation enregistrée')
                  : t('planning.noResultsFilter', 'Aucun résultat pour ce filtre ou cette recherche')}
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
                {t('planning.assignmentsHint', 'Les affectations proviennent de l\'assigné principal (OT) et des opérateurs ajoutés à l\'équipe.')}
              </Typography>
            </Box>
          ) : (
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                  <TableCell sx={{ fontWeight: 600 }}>{t('planning.technician', 'Technicien')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('planning.role', 'Rôle')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('workOrder.number', 'OT')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('planning.workOrderTitle', 'Ordre de travail')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('planning.equipment', 'Équipement')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('planning.scheduledDate', 'Date prévue')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('planning.estimatedDuration', 'Durée estimée')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('planning.priority', 'Priorité')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('planning.status', 'Statut')}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>{t('common.actions', 'Actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAssignments.map((assignment) => (
                  <TableRow
                    key={assignment.id}
                    hover
                    sx={{
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) }
                    }}
                  >
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        {assignment.isPrincipal ? (
                          <Person color="primary" fontSize="small" />
                        ) : (
                          <PersonOutline fontSize="small" color="action" />
                        )}
                        <Typography variant="body2">{assignment.technicianName || '—'}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={assignment.isPrincipal ? t('planning.principal', 'Principal') : t('planning.operator', 'Opérateur')}
                        size="small"
                        variant={assignment.isPrincipal ? 'filled' : 'outlined'}
                        color={assignment.isPrincipal ? 'primary' : 'default'}
                        sx={{ fontWeight: 500 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {assignment.workOrderNumber || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 220 }}>
                      <Typography variant="body2" noWrap title={assignment.workOrderTitle}>
                        {assignment.workOrderTitle || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {assignment.equipmentCode || assignment.equipmentName || '—'}
                        {assignment.equipmentCode && assignment.equipmentName ? ` — ${assignment.equipmentName}` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDate(assignment.scheduled_date)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDuration(assignment.estimated_duration)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t(`priority.${assignment.priority}`, assignment.priority)}
                        size="small"
                        color={getPriorityColor(assignment.priority)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t(`status.${assignment.status}`, assignment.status)}
                        size="small"
                        color={getStatusColor(assignment.status)}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={t('planning.openWorkOrder', 'Ouvrir l\'OT')}>
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/app/work-orders/${assignment.work_order_id}`)}
                          color="primary"
                        >
                          <OpenInNew fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
