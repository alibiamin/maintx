import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import { Person, Build, Assignment, Refresh } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const LIST_PREVIEW = 5;

function EquipmentStatusChip({ status }) {
  const { t } = useTranslation();
  const statusMap = {
    operational: { label: 'planning.resourcesStatusOperational', color: 'success' },
    maintenance: { label: 'planning.resourcesStatusMaintenance', color: 'warning' },
    out_of_service: { label: 'planning.resourcesStatusOutOfService', color: 'error' },
    retired: { label: 'planning.resourcesStatusRetired', color: 'default' }
  };
  const config = statusMap[status] || { label: null, color: 'default' };
  const label = config.label ? t(config.label) : (status || '');
  return <Chip label={label} size="small" color={config.color} sx={{ mt: 0.5 }} />;
}

export default function PlanningResources() {
  const { t } = useTranslation();
  const [resources, setResources] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadResources = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.get('/planning/resources');
      setResources(res.data);
    } catch (err) {
      console.error(err);
      setError(t('planning.errorLoad'));
      setResources(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  if (loading && !resources) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={280} p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {t('planning.resourcesTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {t('planning.resourcesSubtitle')}
          </Typography>
        </Box>
        <Tooltip title={t('common.refresh')}>
          <IconButton onClick={loadResources} disabled={loading} color="primary" size="medium">
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!resources && !loading && (
        <Alert severity="info">
          {t('planning.errorLoad')}
        </Alert>
      )}

      {resources && (
        <Grid container spacing={3}>
          {/* Techniciens */}
          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Person color="primary" />
                  <Typography variant="h6" fontWeight={600}>
                    {t('planning.technicians')}
                  </Typography>
                </Box>
                <Typography variant="h3" fontWeight={700} color="primary">
                  {resources.technicians?.total ?? 0}
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  {resources.technicians?.available ?? 0} {t('planning.available')}
                </Typography>
                <List dense sx={{ flex: 1, overflow: 'auto' }}>
                  {(resources.technicians?.list || []).length === 0 ? (
                    <ListItem>
                      <ListItemText primary={t('planning.noTechnicians')} />
                    </ListItem>
                  ) : (
                    (resources.technicians?.list || []).slice(0, LIST_PREVIEW).map((tech) => (
                      <ListItem key={tech.id}>
                        <Box sx={{ width: '100%' }}>
                          <ListItemText primary={tech.name || tech.email} secondary={tech.assigned_count > 0 ? `${tech.assigned_count} OT` : null} />
                          <Chip
                            label={tech.status === 'available' ? t('planning.statusAvailable') : t('planning.statusAssigned')}
                            size="small"
                            color={tech.status === 'available' ? 'success' : 'default'}
                            sx={{ mt: 0.5 }}
                          />
                        </Box>
                      </ListItem>
                    ))
                  )}
                </List>
                {(resources.technicians?.list || []).length > LIST_PREVIEW && (
                  <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                    {t('planning.firstOf', { count: LIST_PREVIEW, total: resources.technicians.list.length })}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Équipements */}
          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Build color="warning" />
                  <Typography variant="h6" fontWeight={600}>
                    {t('planning.equipment')}
                  </Typography>
                </Box>
                <Typography variant="h3" fontWeight={700} color="warning.main">
                  {resources.equipment?.total ?? 0}
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  {resources.equipment?.operational ?? 0} {t('planning.operational')}
                </Typography>
                <List dense sx={{ flex: 1, overflow: 'auto' }}>
                  {(resources.equipment?.list || []).length === 0 ? (
                    <ListItem>
                      <ListItemText primary={t('planning.noEquipment')} />
                    </ListItem>
                  ) : (
                    (resources.equipment?.list || []).slice(0, LIST_PREVIEW).map((eq) => (
                      <ListItem key={eq.id}>
                        <Box sx={{ width: '100%' }}>
                          <ListItemText primary={eq.name} secondary={eq.code} />
                          <EquipmentStatusChip status={eq.status} />
                        </Box>
                      </ListItem>
                    ))
                  )}
                </List>
                {(resources.equipment?.list || []).length > LIST_PREVIEW && (
                  <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                    {t('planning.firstOf', { count: LIST_PREVIEW, total: resources.equipment.list.length })}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Ordres de travail */}
          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Assignment color="success" />
                  <Typography variant="h6" fontWeight={600}>
                    {t('planning.workOrders')}
                  </Typography>
                </Box>
                <Typography variant="h3" fontWeight={700} color="success.main">
                  {resources.workOrders?.total ?? 0}
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  {resources.workOrders?.pending ?? 0} {t('planning.pending')}
                </Typography>
                <List dense sx={{ flex: 1, overflow: 'auto' }}>
                  {(resources.workOrders?.list || []).length === 0 ? (
                    <ListItem>
                      <ListItemText primary={t('planning.noWorkOrders')} />
                    </ListItem>
                  ) : (
                    (resources.workOrders?.list || []).slice(0, LIST_PREVIEW).map((wo) => (
                      <ListItem key={wo.id}>
                        <Box sx={{ width: '100%' }}>
                          <ListItemText primary={wo.number} secondary={wo.title} />
                          <Chip label={wo.status} size="small" color={wo.status === 'in_progress' ? 'primary' : 'default'} sx={{ mt: 0.5 }} />
                        </Box>
                      </ListItem>
                    ))
                  )}
                </List>
                {(resources.workOrders?.list || []).length > LIST_PREVIEW && (
                  <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                    {t('planning.firstOf', { count: LIST_PREVIEW, total: resources.workOrders.list.length })}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
