import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
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
import InterventionFlow from '../../components/InterventionFlow';

const statusColors = { pending: 'warning', in_progress: 'info', completed: 'success', cancelled: 'default', deferred: 'default' };
const priorityColors = { low: 'default', medium: 'primary', high: 'warning', critical: 'error' };

export default function WorkOrderList() {
  const [searchParams] = useSearchParams();
  const statusFromUrl = searchParams.get('status') || '';
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState(statusFromUrl);
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreate = ['administrateur', 'responsable_maintenance', 'technicien', 'utilisateur'].includes(user?.role);

  useEffect(() => {
    setFilterStatus(statusFromUrl);
  }, [statusFromUrl]);

  useEffect(() => {
    setLoading(true);
    const params = filterStatus ? { status: filterStatus } : {};
    api.get('/work-orders', { params }).then(r => setOrders(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [filterStatus]);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <h2 style={{ margin: 0 }}>Ordres de travail</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>Maintenance corrective et preventive</p>
        </Box>
        {canCreate && (
          <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/creation')}>
            Declarer une panne
          </Button>
        )}
      </Box>

      <InterventionFlow workOrders={orders.filter(o => !['cancelled', 'deferred'].includes(o.status))} />

      <Card sx={{ mb: 2, mt: 3, p: 2 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Statut</InputLabel>
          <Select value={filterStatus} label="Statut" onChange={(e) => setFilterStatus(e.target.value)}>
            <MenuItem value="">Tous</MenuItem>
            <MenuItem value="pending">En attente</MenuItem>
            <MenuItem value="in_progress">En cours</MenuItem>
            <MenuItem value="completed">Termine</MenuItem>
            <MenuItem value="cancelled">Annule</MenuItem>
            <MenuItem value="deferred">Reporte</MenuItem>
          </Select>
        </FormControl>
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
                  <TableCell><Chip label={wo.status} size="small" color={statusColors[wo.status]} /></TableCell>
                  <TableCell><Chip label={wo.priority} size="small" color={priorityColors[wo.priority]} variant="outlined" /></TableCell>
                  <TableCell>{wo.assignedName || '-'}</TableCell>
                  <TableCell>{new Date(wo.createdAt).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => navigate('/work-orders/' + wo.id)}><Visibility /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && orders.length === 0 && (
          <Box p={4} textAlign="center" color="text.secondary">Aucun ordre de travail</Box>
        )}
      </Card>
    </Box>
  );
}
