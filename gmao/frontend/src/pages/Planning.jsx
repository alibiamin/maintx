import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  CircularProgress,
  IconButton,
  Popover,
  alpha,
  useTheme
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Add,
  Build,
  CalendarMonth,
  Person,
  Schedule
} from '@mui/icons-material';
import api from '../services/api';

const priorityColors = { low: 'default', medium: 'primary', high: 'warning', critical: 'error' };
const statusLabels = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
  deferred: 'Reporté'
};

function getDaysInRange(startDate, numDays) {
  const days = [];
  const d = new Date(startDate);
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < numDays; i++) {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    days.push(day);
  }
  return days;
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function Planning() {
  const navigate = useNavigate();
  const theme = useTheme();
  const [rangeStart, setRangeStart] = useState(() => getWeekStart(new Date()));
  const [rangeDays, setRangeDays] = useState(14);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const days = useMemo(() => getDaysInRange(rangeStart, rangeDays), [rangeStart, rangeDays]);
  const startStr = days[0].toISOString().slice(0, 10);
  const endStr = days[days.length - 1].toISOString().slice(0, 10);

  useEffect(() => {
    setLoading(true);
    api.get('/planning/gantt', { params: { start: startStr, end: endStr } })
      .then((r) => setItems(r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [startStr, endStr]);

  const prevRange = () => {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() - rangeDays);
    setRangeStart(d);
  };

  const nextRange = () => {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + rangeDays);
    setRangeStart(d);
  };

  const goToday = () => setRangeStart(getWeekStart(new Date()));

  const formatDay = (d) => d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const isToday = (d) => {
    const t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
  };

  const timelineStart = useMemo(() => {
    const d = new Date(days[0]);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [days]);
  const timelineEnd = useMemo(() => {
    const d = new Date(days[days.length - 1]);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }, [days]);
  const totalMs = timelineEnd - timelineStart;

  const getBarStyle = (item) => {
    const isPreventive = item.type === 'preventive';
    if (isPreventive) {
      return { bgcolor: alpha(theme.palette.info.main, 0.85), color: '#fff' };
    }
    const p = item.priority || 'medium';
    const colorMap = { low: theme.palette.grey[600], medium: theme.palette.primary.main, high: theme.palette.warning.main, critical: theme.palette.error.main };
    return { bgcolor: alpha(colorMap[p] || colorMap.medium, 0.9), color: '#fff' };
  };

  const openDetail = (event, item) => {
    setSelectedItem(item);
    setAnchorEl(event.currentTarget);
  };

  const closeDetail = () => {
    setAnchorEl(null);
    setSelectedItem(null);
  };

  const goToWorkOrder = (id) => {
    if (!id || !id.startsWith('wo-')) return;
    const num = id.replace('wo-', '');
    navigate(`/work-orders/${num}`);
    closeDetail();
  };

  const goToMaintenancePlans = () => {
    navigate('/maintenance-plans');
    closeDetail();
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Planning global
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Interventions préventives et correctives — vue Gantt
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <IconButton onClick={prevRange} size="small" aria-label="Période précédente">
            <ChevronLeft />
          </IconButton>
          <Typography variant="body1" fontWeight={600} sx={{ minWidth: 280, textAlign: 'center' }}>
            {formatDay(days[0])} — {formatDay(days[days.length - 1])}
          </Typography>
          <IconButton onClick={nextRange} size="small" aria-label="Période suivante">
            <ChevronRight />
          </IconButton>
          <Button size="small" onClick={goToday}>Aujourd&apos;hui</Button>
          <Button
            size="small"
            variant={rangeDays === 7 ? 'contained' : 'outlined'}
            onClick={() => setRangeDays(7)}
          >
            7 j
          </Button>
          <Button
            size="small"
            variant={rangeDays === 14 ? 'contained' : 'outlined'}
            onClick={() => setRangeDays(14)}
          >
            14 j
          </Button>
          <Button
            size="small"
            variant={rangeDays === 30 ? 'contained' : 'outlined'}
            onClick={() => setRangeDays(30)}
          >
            30 j
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/creation')}>
            Déclarer panne
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Card sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <CardContent sx={{ p: 0 }}>
            {/* En-tête timeline */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '240px 1fr',
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: alpha(theme.palette.primary.main, 0.04)
              }}
            >
              <Box sx={{ py: 1.5, px: 2, borderRight: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
                  Intervention / Équipement
                </Typography>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${days.length}, 1fr)`,
                  minWidth: 0
                }}
              >
                {days.map((day) => (
                  <Box
                    key={day.toISOString()}
                    sx={{
                      py: 1.5,
                      px: 0.5,
                      textAlign: 'center',
                      borderRight: '1px solid',
                      borderColor: 'divider',
                      bgcolor: isToday(day) ? alpha(theme.palette.primary.main, 0.08) : 'transparent'
                    }}
                  >
                    <Typography
                      variant="caption"
                      fontWeight={isToday(day) ? 700 : 600}
                      color={isToday(day) ? 'primary.main' : 'text.secondary'}
                      display="block"
                    >
                      {day.toLocaleDateString('fr-FR', { weekday: 'short' })}
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {day.getDate()} {day.toLocaleDateString('fr-FR', { month: 'short' })}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Lignes Gantt */}
            {items.length === 0 ? (
              <Box py={6} textAlign="center">
                <CalendarMonth sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary">Aucune intervention sur cette période</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Utilisez les boutons pour changer de période ou créez un OT depuis le menu Création.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ maxHeight: '70vh', overflow: 'auto' }}>
                {items.map((item) => {
                  const startMs = new Date(item.start).getTime();
                  const endMs = new Date(item.end).getTime();
                  const left = Math.max(0, ((startMs - timelineStart) / totalMs) * 100);
                  const width = Math.min(100 - left, ((endMs - startMs) / totalMs) * 100);
                  const barStyle = getBarStyle(item);
                  const isPreventive = item.type === 'preventive';

                  return (
                    <Box
                      key={item.id}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '240px 1fr',
                        minHeight: 52,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.03) }
                      }}
                    >
                      <Box
                        sx={{
                          py: 1,
                          px: 2,
                          borderRight: '1px solid',
                          borderColor: 'divider',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1
                        }}
                      >
                        {isPreventive ? (
                          <CalendarMonth fontSize="small" color="info" />
                        ) : (
                          <Build fontSize="small" color="action" />
                        )}
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap title={item.title}>
                            {item.number ? `${item.number} — ` : ''}{item.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {item.equipment_code || item.equipment_name || '—'}
                          </Typography>
                        </Box>
                      </Box>
                      <Box
                        sx={{
                          position: 'relative',
                          py: 0.5,
                          px: 0.5
                        }}
                      >
                        <Box
                          onClick={(e) => openDetail(e, item)}
                          sx={{
                            position: 'absolute',
                            left: `${left}%`,
                            width: `${Math.max(width, 2)}%`,
                            minWidth: 20,
                            height: 36,
                            borderRadius: 1.5,
                            ...barStyle,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            px: 0.75,
                            boxShadow: 1,
                            '&:hover': { filter: 'brightness(1.05)' }
                          }}
                        >
                          <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 600 }} noWrap>
                            {item.title.length > 20 ? item.title.slice(0, 18) + '…' : item.title}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={closeDetail}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { minWidth: 320, maxWidth: 400, borderRadius: 2 } }}
      >
        {selectedItem && (
          <Box sx={{ p: 2 }}>
            <Box display="flex" alignItems="flex-start" gap={1} mb={1.5}>
              {selectedItem.type === 'preventive' ? (
                <CalendarMonth color="info" />
              ) : (
                <Build color="action" />
              )}
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  {selectedItem.number || selectedItem.plan_name || selectedItem.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedItem.title}
                </Typography>
              </Box>
            </Box>
            {selectedItem.description && (
              <Typography variant="body2" sx={{ mb: 1.5 }} color="text.secondary">
                {selectedItem.description.slice(0, 200)}
                {selectedItem.description.length > 200 ? '…' : ''}
              </Typography>
            )}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
              <Chip size="small" label={selectedItem.type_name || (selectedItem.type === 'preventive' ? 'Préventif' : 'Correctif')} color={selectedItem.type === 'preventive' ? 'info' : 'default'} />
              <Chip size="small" label={statusLabels[selectedItem.status] || selectedItem.status} />
              <Chip size="small" label={selectedItem.priority} color={priorityColors[selectedItem.priority]} />
            </Box>
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 0.5 }}>
              <Schedule fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
              {new Date(selectedItem.start).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} — {new Date(selectedItem.end).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 0.5 }}>
              <Build fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
              {selectedItem.equipment_name || selectedItem.equipment_code || '—'}
            </Typography>
            {selectedItem.assigned_name && (
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1.5 }}>
                <Person fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                {selectedItem.assigned_name}
              </Typography>
            )}
            <Box display="flex" gap={1} justifyContent="flex-end">
              {selectedItem.source === 'work_order' && (
                <Button size="small" variant="contained" onClick={() => goToWorkOrder(selectedItem.id)}>
                  Voir l&apos;OT
                </Button>
              )}
              {selectedItem.source === 'maintenance_plan' && (
                <Button size="small" variant="outlined" onClick={goToMaintenancePlans}>
                  Voir les plans
                </Button>
              )}
            </Box>
          </Box>
        )}
      </Popover>
    </Box>
  );
}
