import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Alert,
  IconButton
} from '@mui/material';
import { Search, Build, Assignment, OpenInNew } from '@mui/icons-material';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

function formatHistoryItem(row) {
  return {
    id: row.id,
    date: row.created_at,
    type: row.type_name || row.type || '—',
    workOrderNumber: row.number || row.workOrderNumber || '—',
    description: row.title || row.description || '—',
    technicianName: row.assigned_name || row.technicianName || '—',
    duration: row.total_hours != null && row.total_hours > 0 ? row.total_hours : null,
    status: row.status
  };
}

export default function EquipmentHistory() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadHistory();
  }, [id]);

  const loadHistory = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.get(`/equipment/${id}/history`);
      const data = res.data?.data ?? res.data ?? [];
      setHistory(Array.isArray(data) ? data.map(formatHistoryItem) : []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Erreur lors du chargement de l\'historique.');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter(
    (h) =>
      !search ||
      (h.description && h.description.toLowerCase().includes(search.toLowerCase())) ||
      (h.workOrderNumber && h.workOrderNumber.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {t('equipmentManagement.historyTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('equipmentManagement.historySubtitle')}
          </Typography>
        </Box>
        <TextField
          size="small"
          placeholder={t('common.searchPlaceholder') || 'Rechercher...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            )
          }}
          sx={{ minWidth: 220 }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : filteredHistory.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              {t('equipmentManagement.noHistory')}
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('equipmentManagement.historyDate')}</TableCell>
                  <TableCell>{t('equipmentManagement.historyType')}</TableCell>
                  <TableCell>{t('equipmentManagement.historyWorkOrder')}</TableCell>
                  <TableCell>{t('equipmentManagement.historyDescription')}</TableCell>
                  <TableCell>{t('equipmentManagement.historyTechnician')}</TableCell>
                  <TableCell>{t('equipmentManagement.historyDuration')}</TableCell>
                  <TableCell>{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredHistory.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      {item.date ? new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={item.type && item.type.toLowerCase().includes('prévent') ? <Build /> : <Assignment />}
                        label={item.type}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{item.workOrderNumber}</TableCell>
                    <TableCell sx={{ maxWidth: 280 }}>{item.description}</TableCell>
                    <TableCell>{item.technicianName}</TableCell>
                    <TableCell>
                      {item.duration != null ? t('equipmentManagement.historyDurationHours', { value: Number(item.duration).toFixed(1) }) : '—'}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={t(`status.${item.status}`, item.status)}
                          size="small"
                          color={item.status === 'completed' ? 'success' : 'default'}
                        />
                        <IconButton size="small" onClick={() => navigate(`/app/work-orders/${item.id}`)} title="Voir l'OT">
                          <OpenInNew fontSize="small" />
                        </IconButton>
                      </Box>
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
