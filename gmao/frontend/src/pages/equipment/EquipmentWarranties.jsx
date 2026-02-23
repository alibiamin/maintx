import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
  Alert
} from '@mui/material';
import { Warning } from '@mui/icons-material';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';
import { useActionPanel } from '../../context/ActionPanelContext';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function EquipmentWarranties() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const { setContext } = useActionPanel();

  useEffect(() => {
    loadWarranties();
  }, [id]);

  useEffect(() => {
    setContext({ type: 'list', entityType: 'warranties' });
    return () => setContext(null);
  }, [setContext]);

  useEffect(() => {
    if (!selectedId) return;
    const w = warranties.find((x) => x.id === selectedId);
    setContext(w ? { type: 'list', entityType: 'warranties', selectedEntity: w } : { type: 'list', entityType: 'warranties' });
  }, [selectedId, warranties, setContext]);

  const loadWarranties = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.get(`/equipment/${id}/warranties`);
      const data = res.data?.data ?? res.data ?? [];
      setWarranties(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Erreur lors du chargement des garanties.');
      setWarranties([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {t('equipmentManagement.warrantiesTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('equipmentManagement.warrantiesSubtitle')}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {t('equipmentManagement.creationHint')}
        </Typography>
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
          ) : warranties.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              {t('equipmentManagement.noWarranties')}
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('equipmentManagement.warrantyNumber')}</TableCell>
                  <TableCell>{t('equipmentManagement.warrantyType')}</TableCell>
                  <TableCell>{t('equipmentManagement.warrantyStart')}</TableCell>
                  <TableCell>{t('equipmentManagement.warrantyEnd')}</TableCell>
                  <TableCell>{t('equipmentManagement.warrantySupplier')}</TableCell>
                  <TableCell>{t('equipmentManagement.warrantyStatusHeader')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {warranties.map((w) => {
                  const endDate = w.end_date ? new Date(w.end_date) : null;
                  const now = new Date();
                  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                  const isExpiring = endDate && endDate < in30Days && endDate >= now;
                  const isExpired = endDate && endDate < now;
                  return (
                    <TableRow
                      key={w.id}
                      selected={selectedId === w.id}
                      onClick={() => setSelectedId(selectedId === w.id ? null : w.id)}
                      sx={{ cursor: 'pointer' }}
                      hover
                    >
                      <TableCell>{w.warranty_number || '—'}</TableCell>
                      <TableCell>
                        <Chip label={w.warranty_type || '—'} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{formatDate(w.start_date)}</TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          {formatDate(w.end_date)}
                          {isExpiring && !isExpired && <Warning color="warning" fontSize="small" titleAccess="Expire bientôt" />}
                          {isExpired && <Warning color="error" fontSize="small" titleAccess="Expirée" />}
                        </Box>
                      </TableCell>
                      <TableCell>{w.supplier_name || '—'}</TableCell>
                      <TableCell>
                        <Chip
                          label={w.is_active && !isExpired ? t('equipmentManagement.warrantyStatusActive') : t('equipmentManagement.warrantyStatusExpired')}
                          size="small"
                          color={w.is_active && !isExpired ? 'success' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
