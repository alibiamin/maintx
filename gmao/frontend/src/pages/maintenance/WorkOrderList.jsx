import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress
} from '@mui/material';
import { Add, Visibility } from '@mui/icons-material';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSnackbar } from '../../context/SnackbarContext';
import InterventionFlow from '../../components/InterventionFlow';
import { useTranslation } from 'react-i18next';

const statusColors = { pending: 'warning', in_progress: 'info', completed: 'success', cancelled: 'default', deferred: 'default' };
const priorityColors = { low: 'default', medium: 'primary', high: 'warning', critical: 'error' };

export default function WorkOrderList() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const statusFromUrl = searchParams.get('status') || '';
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState(statusFromUrl);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [loadError, setLoadError] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const canCreate = ['administrateur', 'responsable_maintenance', 'technicien', 'utilisateur'].includes(user?.role);

  useEffect(() => {
    setFilterStatus(statusFromUrl);
  }, [statusFromUrl]);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    const params = { page: page + 1, limit: rowsPerPage, sortBy, order: sortOrder };
    if (filterStatus) params.status = filterStatus;
    api.get('/work-orders', { params })
      .then(r => {
        setOrders(r.data?.data ?? r.data ?? []);
        setTotal(r.data?.total ?? (r.data?.length ?? 0));
      })
      .catch((err) => {
        const msg = err.response?.data?.error || 'Erreur chargement des ordres de travail';
        setLoadError(msg);
        snackbar.showError(msg);
      })
      .finally(() => setLoading(false));
  }, [filterStatus, page, rowsPerPage, sortBy, sortOrder, snackbar]);

  const handleChangePage = (_, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); };

  return (
    <Box>
      {loadError && (
        <Alert severity="error" onClose={() => setLoadError(null)} sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <h2 style={{ margin: 0 }}>Ordres de travail</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>Maintenance corrective et preventive</p>
        </Box>
        {canCreate && (
          <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/app/work-orders/new')}>
            Declarer une panne
          </Button>
        )}
      </Box>

      <InterventionFlow workOrders={orders.filter(o => !['cancelled', 'deferred'].includes(o.status))} />

      <Card sx={{ mb: 2, mt: 3, p: 2 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Statut</InputLabel>
            <Select value={filterStatus} label="Statut" onChange={(e) => setFilterStatus(e.target.value)}>
              <MenuItem value="">{t('common.all', 'Tous')}</MenuItem>
              <MenuItem value="pending">{t('status.pending')}</MenuItem>
              <MenuItem value="in_progress">{t('status.in_progress')}</MenuItem>
              <MenuItem value="completed">{t('status.completed')}</MenuItem>
              <MenuItem value="cancelled">{t('status.cancelled')}</MenuItem>
              <MenuItem value="deferred">{t('status.deferred')}</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Tri</InputLabel>
            <Select value={`${sortBy}-${sortOrder}`} label="Tri" onChange={(e) => {
              const [s, o] = e.target.value.split('-');
              setSortBy(s);
              setSortOrder(o);
              setPage(0);
            }}>
              <MenuItem value="created_at-desc">Date (récent)</MenuItem>
              <MenuItem value="created_at-asc">Date (ancien)</MenuItem>
              <MenuItem value="number-desc">N° OT (Z-A)</MenuItem>
              <MenuItem value="number-asc">N° OT (A-Z)</MenuItem>
              <MenuItem value="title-asc">Titre (A-Z)</MenuItem>
              <MenuItem value="title-desc">Titre (Z-A)</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Card>

      <Card>
        {loading ? (
          <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>N OT</TableCell>
                <TableCell>Titre</TableCell>
                <TableCell>Equipement</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Priorite</TableCell>
                <TableCell>Technicien</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((wo) => (
                <TableRow key={wo.id} hover>
                  <TableCell>{wo.number}</TableCell>
                  <TableCell>{wo.title}</TableCell>
                  <TableCell>{wo.equipmentName || '-'}</TableCell>
                  <TableCell><Chip label={t(`status.${wo.status}`, wo.status)} size="small" color={statusColors[wo.status]} /></TableCell>
                  <TableCell><Chip label={t(`priority.${wo.priority}`, wo.priority)} size="small" color={priorityColors[wo.priority]} variant="outlined" /></TableCell>
                  <TableCell>{wo.assignedName || '-'}</TableCell>
                  <TableCell>{new Date(wo.createdAt).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => navigate('/app/work-orders/' + wo.id)}><Visibility /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && orders.length === 0 && (
          <Box p={4} textAlign="center" color="text.secondary">Aucun ordre de travail</Box>
        )}
        {!loading && total > 0 && (
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 20, 50]}
            labelRowsPerPage="Lignes par page"
          />
        )}
      </Card>
    </Box>
  );
}
