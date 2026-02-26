import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useSnackbar } from '../context/SnackbarContext';

const priorityColors = { low: 'default', medium: 'primary', high: 'warning', critical: 'error' };

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

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE'];

function toDateStr(d) {
  return new Date(d).toISOString().slice(0, 10);
}
function toDateTimeStr(d) {
  return new Date(d).toISOString().slice(0, 19).replace('T', ' ');
}

function getFirstDayOfMonth(d) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getLastDayOfMonth(d) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Returns array of weeks; each week is array of 7 Date (Mon–Sun). Month view: 6 weeks. */
function getCalendarGrid(calendarDate, viewMode) {
  if (viewMode === 'week') {
    const start = getWeekStart(calendarDate);
    return [getDaysInRange(start, 7)];
  }
  const first = getFirstDayOfMonth(calendarDate);
  const gridStart = getWeekStart(first);
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const weekStart = new Date(gridStart);
    weekStart.setDate(gridStart.getDate() + w * 7);
    weeks.push(getDaysInRange(weekStart, 7));
  }
  return weeks;
}

function getCalendarRange(calendarDate, viewMode) {
  if (viewMode === 'week') {
    const start = getWeekStart(calendarDate);
    const days = getDaysInRange(start, 7);
    return { startStr: toDateStr(days[0]), endStr: toDateStr(days[6]) };
  }
  const first = getFirstDayOfMonth(calendarDate);
  const last = getLastDayOfMonth(calendarDate);
  return { startStr: toDateStr(first), endStr: toDateStr(last) };
}

function isFinishedOrCancelled(item) {
  return item.source === 'work_order' && (item.status === 'completed' || item.status === 'cancelled');
}

function getBorderColorForItem(item, theme) {
  if (isFinishedOrCancelled(item)) return theme.palette.grey[500];
  if (item.type === 'preventive') return theme.palette.info.main;
  const p = item.priority || 'medium';
  const map = { low: theme.palette.grey[600], medium: theme.palette.primary.main, high: theme.palette.warning.main, critical: theme.palette.error.main };
  return map[p] || map.medium;
}

/** Retourne les événements qui tombent sur le jour `day` en utilisant la date calendaire locale (évite décalage timezone). */
function eventsForDay(items, day) {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  const dayStart = d.getTime();
  const dayEnd = dayStart + MS_PER_DAY - 1;
  return items.filter((it) => {
    const startDt = new Date(it.start);
    const endDt = new Date(it.end);
    const eventStartDay = new Date(startDt.getFullYear(), startDt.getMonth(), startDt.getDate());
    eventStartDay.setHours(0, 0, 0, 0);
    const eventEndDay = new Date(endDt.getFullYear(), endDt.getMonth(), endDt.getDate());
    eventEndDay.setHours(23, 59, 59, 999);
    return eventStartDay.getTime() <= dayEnd && eventEndDay.getTime() >= dayStart;
  });
}

export default function Planning() {
  const { can } = useAuth();
  const snackbar = useSnackbar();
  const { t: t2 } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const timelineRef = useRef(null);
  const calendarGridRef = useRef(null);
  const [viewMode, setViewMode] = useState('month'); // 'gantt' | 'month' | 'week'
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [rangeStart, setRangeStart] = useState(() => getWeekStart(new Date()));
  const [rangeDays, setRangeDays] = useState(14);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const dragDeltaDaysRef = useRef(0);
  const didDragRef = useRef(false);

  const canUpdateWo = can('work_orders', 'update');
  const canUpdatePlan = can('maintenance_plans', 'update');

  const days = useMemo(() => getDaysInRange(rangeStart, rangeDays), [rangeStart, rangeDays]);
  const calendarRange = useMemo(() => (viewMode !== 'gantt' ? getCalendarRange(calendarDate, viewMode) : null), [viewMode, calendarDate]);
  const startStr = calendarRange ? calendarRange.startStr : days[0].toISOString().slice(0, 10);
  const endStr = calendarRange ? calendarRange.endStr : days[days.length - 1].toISOString().slice(0, 10);

  const calendarWeeks = useMemo(() => (viewMode !== 'gantt' ? getCalendarGrid(calendarDate, viewMode) : []), [viewMode, calendarDate]);

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

  const prevCalendar = () => {
    const d = new Date(calendarDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    setCalendarDate(d);
  };

  const nextCalendar = () => {
    const d = new Date(calendarDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 7);
    setCalendarDate(d);
  };

  const goTodayCalendar = () => setCalendarDate(new Date());

  const calendarTitle = viewMode === 'month'
    ? calendarDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : (() => {
        const start = getWeekStart(calendarDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        return `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      })();

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
    if (isFinishedOrCancelled(item)) {
      return { bgcolor: theme.palette.grey[400], color: theme.palette.grey[700] };
    }
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
    navigate(`/app/work-orders/${num}`);
    closeDetail();
  };

  const goToMaintenancePlans = () => {
    navigate('/app/maintenance-plans');
    closeDetail();
  };

  const saveNewDates = useCallback(async (item, newStartMs, newEndMs) => {
    if (item.source === 'work_order') {
      const id = item.sourceId;
      setSavingId(item.id);
      try {
        await api.put(`/work-orders/${id}`, {
          plannedStart: toDateTimeStr(newStartMs),
          plannedEnd: toDateTimeStr(newEndMs)
        });
        snackbar.showSuccess('Dates planifiées mises à jour');
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, start: new Date(newStartMs).toISOString(), end: new Date(newEndMs).toISOString() }
              : it
          )
        );
      } catch (err) {
        snackbar.showError(err.response?.data?.error || 'Erreur lors de la mise à jour des dates');
      } finally {
        setSavingId(null);
      }
    } else if (item.source === 'maintenance_plan') {
      const id = item.sourceId;
      setSavingId(item.id);
      try {
        await api.put(`/maintenance-plans/${id}`, {
          nextDueDate: toDateStr(newStartMs)
        });
        snackbar.showSuccess('Échéance du plan mise à jour');
        const endMs = newStartMs + MS_PER_DAY;
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, start: new Date(newStartMs).toISOString(), end: new Date(endMs).toISOString() }
              : it
          )
        );
      } catch (err) {
        snackbar.showError(err.response?.data?.error || 'Erreur lors de la mise à jour de l\'échéance');
      } finally {
        setSavingId(null);
      }
    }
  }, [snackbar]);

  const startDrag = useCallback((e, item, calendarStartDay = null) => {
    e.preventDefault();
    e.stopPropagation();
    didDragRef.current = false;
    const canDrag =
      (item.source === 'work_order' && canUpdateWo && !isFinishedOrCancelled(item)) ||
      (item.source === 'maintenance_plan' && canUpdatePlan);
    if (!canDrag) return;
    setDragState({
      itemId: item.id,
      item,
      startX: e.clientX,
      startY: e.clientY,
      startStartMs: new Date(item.start).getTime(),
      startEndMs: new Date(item.end).getTime(),
      deltaDays: 0,
      calendarStartDay: calendarStartDay ? new Date(calendarStartDay) : null
    });
  }, [canUpdateWo, canUpdatePlan]);

  const handleBarClick = useCallback((e, item) => {
    if (didDragRef.current) return;
    openDetail(e, item);
  }, []);

  useEffect(() => {
    if (!dragState) return;
    const state = dragState;

    const onUp = (deltaDays) => {
      setDragState(null);
      if (deltaDays === 0) return;
      const newStartMs = state.startStartMs + deltaDays * MS_PER_DAY;
      const newEndMs = state.startEndMs + deltaDays * MS_PER_DAY;
      saveNewDates(state.item, newStartMs, newEndMs);
    };

    if (state.calendarStartDay != null) {
      // Drag en vue Calendrier (Mois/Semaine) : calcul du jour sous le curseur via la grille
      const gridEl = calendarGridRef.current;
      const calendarWeeks = viewMode === 'week'
        ? getCalendarGrid(calendarDate, 'week')
        : getCalendarGrid(calendarDate, 'month');
      const numRows = calendarWeeks.length;

      const onMove = (e) => {
        if (!gridEl || !numRows) return;
        const rect = gridEl.getBoundingClientRect();
        const colWidth = rect.width / 7;
        const rowHeight = rect.height / numRows;
        const col = Math.floor((e.clientX - rect.left) / colWidth);
        const row = Math.floor((e.clientY - rect.top) / rowHeight);
        const c = Math.max(0, Math.min(6, col));
        const r = Math.max(0, Math.min(numRows - 1, row));
        const day = calendarWeeks[r]?.[c];
        if (!day) return;
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const startNorm = new Date(state.calendarStartDay);
        startNorm.setHours(0, 0, 0, 0);
        const deltaDays = Math.round((dayStart.getTime() - startNorm.getTime()) / MS_PER_DAY);
        if (deltaDays !== 0) didDragRef.current = true;
        dragDeltaDaysRef.current = deltaDays;
        setDragState((prev) => (prev ? { ...prev, deltaDays } : null));
      };

      const onUpHandler = () => {
        const deltaDays = dragDeltaDaysRef.current;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUpHandler);
        onUp(deltaDays);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUpHandler);
      return () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUpHandler);
      };
    }

    // Drag en vue Gantt
    const el = timelineRef.current;
    const onMove = (e) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const timelineWidth = rect.width;
      const widthPerDay = timelineWidth / rangeDays;
      const deltaPx = e.clientX - state.startX;
      const deltaDays = widthPerDay ? Math.round(deltaPx / widthPerDay) : 0;
      if (deltaDays !== 0) didDragRef.current = true;
      dragDeltaDaysRef.current = deltaDays;
      setDragState((prev) => (prev ? { ...prev, deltaDays } : null));
    };
    const onUpHandler = () => {
      const deltaDays = dragDeltaDaysRef.current;
      setDragState(null);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUpHandler);
      onUp(deltaDays);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUpHandler);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUpHandler);
    };
  }, [dragState?.itemId, dragState?.calendarStartDay, rangeDays, saveNewDates, viewMode, calendarDate]);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Planning global
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {viewMode === 'gantt' ? t2('item.planning_drag_hint') : 'Interventions préventives et correctives — vue calendrier.'}
          </Typography>
          {viewMode !== 'gantt' && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1, alignItems: 'center' }}>
              <Typography component="span" variant="caption" color="text.secondary">Légende :</Typography>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: theme.palette.info.main }} />
                <Typography variant="caption">Préventif</Typography>
              </Box>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: theme.palette.primary.main }} />
                <Typography variant="caption">Correctif</Typography>
              </Box>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: theme.palette.grey[400] }} />
                <Typography variant="caption">Terminé / annulé (non déplaçable)</Typography>
              </Box>
            </Box>
          )}
        </Box>
        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
          {/* Toggle Mois / Semaine / Gantt */}
          <Box sx={{ display: 'flex', borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
            <Button
              size="small"
              variant={viewMode === 'month' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('month')}
              sx={{ minWidth: 90, borderRadius: 0, boxShadow: viewMode === 'month' ? 1 : 0 }}
            >
              {t2('item.planning_view_month')}
            </Button>
            <Button
              size="small"
              variant={viewMode === 'week' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('week')}
              sx={{ minWidth: 90, borderRadius: 0, boxShadow: viewMode === 'week' ? 1 : 0 }}
            >
              {t2('item.planning_view_week')}
            </Button>
            <Button
              size="small"
              variant={viewMode === 'gantt' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('gantt')}
              sx={{ minWidth: 90, borderRadius: 0, boxShadow: viewMode === 'gantt' ? 1 : 0 }}
            >
              {t2('item.planning_view_gantt')}
            </Button>
          </Box>
          {viewMode !== 'gantt' ? (
            <>
              <IconButton onClick={prevCalendar} size="small" aria-label="Période précédente">
                <ChevronLeft />
              </IconButton>
              <Typography variant="body1" fontWeight={600} sx={{ minWidth: 220, textAlign: 'center', textTransform: 'capitalize' }}>
                {calendarTitle}
              </Typography>
              <IconButton onClick={nextCalendar} size="small" aria-label="Période suivante">
                <ChevronRight />
              </IconButton>
              <Button size="small" onClick={goTodayCalendar}>Aujourd&apos;hui</Button>
            </>
          ) : (
            <>
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
              <Button size="small" variant={rangeDays === 7 ? 'contained' : 'outlined'} onClick={() => setRangeDays(7)}>7 j</Button>
              <Button size="small" variant={rangeDays === 14 ? 'contained' : 'outlined'} onClick={() => setRangeDays(14)}>14 j</Button>
              <Button size="small" variant={rangeDays === 30 ? 'contained' : 'outlined'} onClick={() => setRangeDays(30)}>30 j</Button>
            </>
          )}
          <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/app/work-orders/new')}>
            Déclarer panne
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : viewMode !== 'gantt' ? (
        /* Vue Calendrier (Mois / Semaine) */
        <Card sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <CardContent sx={{ p: 0 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: alpha(theme.palette.primary.main, 0.04)
              }}
            >
              {WEEKDAY_LABELS.map((label) => (
                <Box key={label} sx={{ py: 1.5, px: 0.5, textAlign: 'center', borderRight: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    {label}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Box
              ref={calendarGridRef}
              sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 120 * calendarWeeks.length }}
            >
              {calendarWeeks.flatMap((week) =>
                week.map((day) => {
                  const dayEvents = eventsForDay(items, day);
                  const isCurrentMonth = viewMode === 'week' || day.getMonth() === calendarDate.getMonth();
                  return (
                    <Box
                      key={day.toISOString()}
                      sx={{
                        minHeight: 120,
                        borderRight: '1px solid',
                        borderBottom: '1px solid',
                        borderColor: isToday(day) ? 'primary.main' : 'divider',
                        borderWidth: isToday(day) ? 2 : 1,
                        bgcolor: isToday(day) ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                        opacity: isCurrentMonth ? 1 : 0.6
                      }}
                    >
                      <Typography variant="caption" sx={{ display: 'block', p: 0.5, color: 'text.secondary' }}>
                        {day.getDate()}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, px: 0.5, pb: 0.5, overflow: 'hidden' }}>
                        {dayEvents.map((item) => {
                          const borderColor = getBorderColorForItem(item, theme);
                          const canDrag =
                            (item.source === 'work_order' && canUpdateWo && !isFinishedOrCancelled(item)) ||
                            (item.source === 'maintenance_plan' && canUpdatePlan);
                          const isDragging = dragState?.itemId === item.id;
                          const isSaving = savingId === item.id;
                          return (
                            <Box
                              key={`${item.id}-${day.toISOString()}`}
                              onClick={(e) => handleBarClick(e, item)}
                              onMouseDown={(e) => startDrag(e, item, day)}
                              sx={{
                                bgcolor: isFinishedOrCancelled(item) ? theme.palette.grey[200] : 'background.paper',
                                borderLeft: '4px solid',
                                borderLeftColor: borderColor,
                                borderRadius: '0 4px 4px 0',
                                px: 0.75,
                                py: 0.5,
                                cursor: canDrag ? 'grab' : 'pointer',
                                boxShadow: isDragging ? 2 : '0 1px 2px rgba(0,0,0,0.06)',
                                opacity: isSaving ? 0.7 : isFinishedOrCancelled(item) ? 0.85 : 1,
                                userSelect: 'none',
                                pointerEvents: isSaving ? 'none' : 'auto',
                                '&:hover': { bgcolor: isFinishedOrCancelled(item) ? theme.palette.grey[300] : alpha(theme.palette.primary.main, 0.06) },
                                '&:active': { cursor: canDrag ? 'grabbing' : 'pointer' }
                              }}
                            >
                              {isSaving ? (
                                <CircularProgress size={16} sx={{ display: 'block' }} />
                              ) : (
                                <Typography variant="caption" fontWeight={600} noWrap sx={{ display: 'block', color: isFinishedOrCancelled(item) ? 'text.secondary' : 'inherit' }}>
                                  {item.title.length > 22 ? item.title.slice(0, 20) + '…' : item.title}
                                </Typography>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  );
                })
              )}
            </Box>
          </CardContent>
        </Card>
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
                ref={timelineRef}
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
                  const isDragging = dragState?.itemId === item.id;
                  const deltaDays = isDragging ? (dragState.deltaDays ?? 0) : 0;
                  const startMs = new Date(item.start).getTime();
                  const endMs = new Date(item.end).getTime();
                  const displayStartMs = startMs + deltaDays * MS_PER_DAY;
                  const displayEndMs = endMs + deltaDays * MS_PER_DAY;
                  const left = Math.max(0, ((displayStartMs - timelineStart) / totalMs) * 100);
                  const width = Math.min(100 - left, ((displayEndMs - displayStartMs) / totalMs) * 100);
                  const barStyle = getBarStyle(item);
                  const isPreventive = item.type === 'preventive';
                  const canDrag =
                    (item.source === 'work_order' && canUpdateWo && !isFinishedOrCancelled(item)) ||
                    (item.source === 'maintenance_plan' && canUpdatePlan);
                  const isSaving = savingId === item.id;

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
                          onClick={(e) => handleBarClick(e, item)}
                          onMouseDown={(e) => startDrag(e, item)}
                          sx={{
                            position: 'absolute',
                            left: `${left}%`,
                            width: `${Math.max(width, 2)}%`,
                            minWidth: 20,
                            height: 36,
                            borderRadius: 1.5,
                            ...barStyle,
                            cursor: canDrag ? 'grab' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            px: 0.75,
                            boxShadow: isDragging ? 3 : 1,
                            opacity: isSaving ? 0.7 : 1,
                            zIndex: isDragging ? 10 : 1,
                            userSelect: 'none',
                            pointerEvents: isSaving ? 'none' : 'auto',
                            '&:hover': { filter: canDrag ? 'brightness(1.05)' : 'none' },
                            '&:active': { cursor: canDrag ? 'grabbing' : 'pointer' }
                          }}
                        >
                          {isSaving ? (
                            <CircularProgress size={20} sx={{ color: 'inherit' }} />
                          ) : (
                            <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 600 }} noWrap>
                              {item.title.length > 20 ? item.title.slice(0, 18) + '…' : item.title}
                            </Typography>
                          )}
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
              <Chip size="small" label={t2(`status.${selectedItem.status}`, selectedItem.status)} />
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
