import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  LinearProgress,
  Skeleton,
  alpha,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer
} from '@mui/material';
import {
  TrendingUp,
  Build,
  Assignment,
  Warning,
  Euro,
  Schedule,
  BugReport,
  Speed,
  Timeline,
  Business,
  Inventory,
  Handyman,
  People,
  AddTask,
  Link as LinkIcon,
  Add,
  Assessment,
  ArrowForward,
  NotificationsActive,
  DashboardCustomize,
  LocationOn,
  Category,
  ViewList,
  PrecisionManufacturing
} from '@mui/icons-material';
import ReactApexChart from 'react-apexcharts';
import api from '../services/api';
import { useTheme } from '@mui/material/styles';
import { useCurrency } from '../context/CurrencyContext';
import { CHART_COLORS, apexChartTheme } from '../shared/chartTheme';
import { useTranslation } from 'react-i18next';

// Format date relative (il y a X min, hier, date)
function formatRelative(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffM = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffM < 1) return "À l'instant";
  if (diffM < 60) return `Il y a ${diffM} min`;
  if (diffH < 24) return `Il y a ${diffH} h`;
  if (diffD === 1) return 'Hier';
  if (diffD < 7) return `Il y a ${diffD} j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// Formater le libellé de semaine pour l'axe X (ex: "2024-W12" -> "S.12", "2024-03" -> "Mars")
function formatWeekLabel(weekStr) {
  if (!weekStr) return weekStr;
  const wMatch = String(weekStr).match(/W?(\d+)$/);
  if (wMatch) return `S.${wMatch[1]}`;
  const mMatch = String(weekStr).match(/-(\d{2})$/);
  if (mMatch) {
    const months = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
    const m = parseInt(mMatch[1], 10);
    return months[m - 1] || weekStr;
  }
  return weekStr.length > 8 ? weekStr.slice(-5) : weekStr;
}

const DEFAULT_DASHBOARD_LAYOUT = ['alerts', 'kpis', 'summary', 'woByEntity', 'charts', 'analytics', 'technicianPerformance', 'recent', 'topFailures'];
const WIDGET_LABELS = {
  alerts: 'Alertes (stock, SLA, plans)',
  kpis: 'Indicateurs clés (dispo, coût, MTTR, préventif)',
  summary: 'Résumé période et accès rapide',
  woByEntity: 'Répartition OT par Site / Département / Ligne / Équipement',
  charts: 'Graphiques (statuts, priorités, évolution)',
  analytics: 'BI : Coûts par équipement et MTTR',
  technicianPerformance: 'Performance des techniciens',
  recent: 'Activité récente (OT)',
  topFailures: 'Équipements les plus en panne'
};

export default function Dashboard() {
  const [kpis, setKpis] = useState(null);
  const [charts, setCharts] = useState(null);
  const [recent, setRecent] = useState([]);
  const [alerts, setAlerts] = useState({ stock: [], sla: [], overduePlans: [] });
  const [topFailures, setTopFailures] = useState([]);
  const [technicianPerformance, setTechnicianPerformance] = useState([]);
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [woByEntity, setWoByEntity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [profile, setProfile] = useState(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [customLayout, setCustomLayout] = useState([...DEFAULT_DASHBOARD_LAYOUT]);
  const [woByEntityTab, setWoByEntityTab] = useState(0);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const muiTheme = useTheme();
  const currency = useCurrency();
  const isDark = muiTheme.palette.mode === 'dark';
  const apexTheme = React.useMemo(() => apexChartTheme(isDark), [isDark]);

  useEffect(() => {
    api.get('/auth/me').then(r => setProfile(r.data)).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/dashboard/kpis', { params: { period } }),
      api.get('/dashboard/charts'),
      api.get('/dashboard/recent'),
      api.get('/dashboard/alerts').catch(() => ({ data: { stock: [], sla: [], overduePlans: [] } })),
      api.get('/dashboard/top-failures', { params: { limit: 5 } }).catch(() => ({ data: [] })),
      api.get('/dashboard/technician-performance', { params: { period, limit: 8 } }).catch(() => ({ data: [] })),
      api.get('/dashboard/summary', { params: { period } }).catch(() => ({ data: null })),
      api.get('/dashboard/analytics', { params: { period } }).catch(() => ({ data: null })),
      api.get('/dashboard/wo-by-entity').catch(() => ({ data: null }))
    ]).then(([k, c, r, a, t, perf, s, ax, wo]) => {
      setKpis(k.data);
      setCharts(c.data);
      setRecent(r.data);
      setAlerts(a.data);
      setTopFailures(t.data || []);
      setTechnicianPerformance(perf.data || []);
      setSummary(s.data);
      setAnalytics(ax?.data || null);
      setWoByEntity(wo?.data || null);
    }).catch(console.error).finally(() => setLoading(false));
  }, [period]);

  // Layout affiché : uniquement le layout sauvegardé (pas de ré-ajout des widgets par défaut), pour que les widgets décochés restent masqués
  const savedLayout = (profile?.dashboardLayout != null && Array.isArray(profile.dashboardLayout))
    ? profile.dashboardLayout
    : DEFAULT_DASHBOARD_LAYOUT;
  const visibleOrder = savedLayout.filter((id) => WIDGET_LABELS[id]);

  const openCustomize = () => {
    if (profile == null) {
      api.get('/auth/me')
        .then(r => {
          const data = r.data;
          setProfile(data);
          const layout = (data?.dashboardLayout != null && Array.isArray(data.dashboardLayout))
            ? [...data.dashboardLayout]
            : [...DEFAULT_DASHBOARD_LAYOUT];
          setCustomLayout(layout);
          setCustomizeOpen(true);
        })
        .catch(() => {
          setCustomLayout([...DEFAULT_DASHBOARD_LAYOUT]);
          setCustomizeOpen(true);
        });
    } else {
      const layout = (profile.dashboardLayout != null && Array.isArray(profile.dashboardLayout))
        ? [...profile.dashboardLayout]
        : [...DEFAULT_DASHBOARD_LAYOUT];
      setCustomLayout(layout);
      setCustomizeOpen(true);
    }
  };

  const saveDashboardLayout = () => {
    api.put('/auth/me', {
      pinnedMenuItems: profile?.pinnedMenuItems ?? [],
      dashboardLayout: customLayout
    })
      .then(r => {
        const updated = r.data;
        setProfile(prev => ({
          ...(prev || {}),
          ...updated,
          dashboardLayout: updated?.dashboardLayout ?? customLayout
        }));
        setCustomizeOpen(false);
      })
      .catch(err => {
        console.error(err);
      });
  };

  const resetDashboardLayout = () => setCustomLayout([...DEFAULT_DASHBOARD_LAYOUT]);

  const statusColors = { pending: 'warning', in_progress: 'info', completed: 'success', cancelled: 'default', deferred: 'default' };
  const byStatusData = (charts?.byStatus || []).map(s => ({ ...s, label: t(`status.${s.status}`, s.status) }));
  const byPriorityData = (charts?.byPriority || []).map((p, i) => ({ name: t(`priority.${p.priority}`, p.priority), value: p.count, fill: CHART_COLORS[i % CHART_COLORS.length] }));
  const statuses = ['pending', 'in_progress', 'completed'];
  const weeks = [...new Set((charts?.weeklyOT || []).map(w => w.week))].sort();
  const areaEvolutionData = weeks.map(w => {
    const row = { week: w, total: 0 };
    statuses.forEach(status => {
      const count = (charts?.weeklyOT || []).find(x => x.week === w && x.status === status)?.count || 0;
      row[status] = count;
      row.total += count;
    });
    return row;
  });
  const byTypeData = (charts?.byType || []).map((t, i) => ({ name: (t.name || 'N/A').slice(0, 20), count: t.count, fill: CHART_COLORS[i % CHART_COLORS.length] }));

  const totalAlerts = (alerts.stock?.length || 0) + (alerts.sla?.length || 0) + (alerts.overduePlans?.length || 0);

  if (loading) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Skeleton variant="rounded" height={120} sx={{ mb: 3, borderRadius: 3 }} />
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map(i => (
            <Grid item xs={6} md={3} key={i}><Skeleton variant="rounded" height={140} sx={{ borderRadius: 2 }} /></Grid>
          ))}
        </Grid>
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12} md={6}><Skeleton variant="rounded" height={320} sx={{ borderRadius: 2 }} /></Grid>
          <Grid item xs={12} md={6}><Skeleton variant="rounded" height={320} sx={{ borderRadius: 2 }} /></Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', zIndex: 1, minHeight: '100%' }}>
      {/* Hero / En-tête */}
      <Box
        sx={{
          borderRadius: 3,
          mb: 3,
          p: { xs: 2, md: 3 },
          background: isDark
            ? `linear-gradient(135deg, ${alpha(muiTheme.palette.primary.main, 0.15)} 0%, ${alpha(muiTheme.palette.primary.dark, 0.08)} 50%, transparent 100%)`
            : `linear-gradient(135deg, ${alpha(muiTheme.palette.primary.main, 0.08)} 0%, ${alpha(muiTheme.palette.primary.light, 0.04)} 100%)`,
          border: `1px solid ${alpha(muiTheme.palette.primary.main, isDark ? 0.2 : 0.12)}`,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={800} letterSpacing="-0.03em" sx={{ mb: 0.5 }}>
            Tableau de bord
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Vue d'ensemble de la maintenance et des indicateurs clés
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          {totalAlerts > 0 && (
            <Chip
              icon={<NotificationsActive />}
              label={`${totalAlerts} alerte${totalAlerts > 1 ? 's' : ''}`}
              color="warning"
              size="medium"
              onClick={() => document.getElementById('dashboard-alerts')?.scrollIntoView({ behavior: 'smooth' })}
              sx={{ cursor: 'pointer', fontWeight: 600 }}
            />
          )}
          <Button
            startIcon={<DashboardCustomize />}
            onClick={openCustomize}
            size="small"
            variant="outlined"
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Personnaliser
          </Button>
          <ToggleButtonGroup
            value={period}
            exclusive
            onChange={(_, v) => v != null && setPeriod(v)}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                px: 2,
                py: 1,
                textTransform: 'none',
                fontWeight: 600,
                '&.Mui-selected': { bgcolor: alpha(muiTheme.palette.primary.main, 0.2), color: 'primary.main' }
              }
            }}
          >
            <ToggleButton value={7}>7 jours</ToggleButton>
            <ToggleButton value={30}>30 jours</ToggleButton>
            <ToggleButton value={90}>90 jours</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      <Dialog open={customizeOpen} onClose={() => setCustomizeOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Widgets du tableau de bord</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pt: 1 }}>
            {(Object.keys(WIDGET_LABELS)).map(id => (
              <FormControlLabel
                key={id}
                control={
                  <Checkbox
                    checked={customLayout.includes(id)}
                    onChange={(_, checked) => {
                      if (checked) setCustomLayout(prev => [...prev, id]);
                      else setCustomLayout(prev => prev.filter(x => x !== id));
                    }}
                  />
                }
                label={WIDGET_LABELS[id]}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={resetDashboardLayout}>Réinitialiser</Button>
          <Button onClick={() => setCustomizeOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={saveDashboardLayout}>Enregistrer</Button>
        </DialogActions>
      </Dialog>

      {/* Alertes — bandeau compact */}
      {visibleOrder.includes('alerts') && (alerts.stock?.length > 0 || alerts.sla?.length > 0 || alerts.overduePlans?.length > 0) && (
        <Box id="dashboard-alerts" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Warning fontSize="small" /> Alertes
          </Typography>
          <Grid container spacing={1.5}>
            {alerts.stock?.length > 0 && (
              <Grid item xs={12} sm={4}>
                <Card
                  sx={{
                    borderRadius: 2,
                    borderLeft: 4,
                    borderColor: 'warning.main',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 }
                  }}
                  onClick={() => navigate('/app/stock/alerts')}
                >
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="body2" fontWeight={600}>Stock sous seuil</Typography>
                    <Typography variant="caption" color="text.secondary">{alerts.stock.length} pièce(s) : {alerts.stock.slice(0, 2).map(s => s.name).join(', ')}{alerts.stock.length > 2 ? '…' : ''}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
            {alerts.sla?.length > 0 && (
              <Grid item xs={12} sm={4}>
                <Card
                  sx={{
                    borderRadius: 2,
                    borderLeft: 4,
                    borderColor: 'error.main',
                    cursor: 'pointer',
                    '&:hover': { boxShadow: 2 }
                  }}
                  onClick={() => navigate('/app/work-orders')}
                >
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="body2" fontWeight={600}>SLA dépassé</Typography>
                    <Typography variant="caption" color="text.secondary">{alerts.sla.length} OT en retard</Typography>
                    <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {alerts.sla.slice(0, 3).map(wo => (
                        <Chip key={wo.id} label={wo.number} size="small" onClick={(e) => { e.stopPropagation(); navigate(`/app/work-orders/${wo.id}`); }} sx={{ cursor: 'pointer', height: 24 }} />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )}
            {alerts.overduePlans?.length > 0 && (
              <Grid item xs={12} sm={4}>
                <Card
                  sx={{
                    borderRadius: 2,
                    borderLeft: 4,
                    borderColor: 'warning.main',
                    cursor: 'pointer',
                    '&:hover': { boxShadow: 2 }
                  }}
                  onClick={() => navigate('/app/maintenance-plans/due')}
                >
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="body2" fontWeight={600}>Plans en retard</Typography>
                    <Typography variant="caption" color="text.secondary">{alerts.overduePlans.length} plan(s) préventif(s)</Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </Box>
      )}

      {/* KPIs principaux — cartes avec jauge radiale */}
      {visibleOrder.includes('kpis') && (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, overflow: 'hidden', height: '100%', border: `1px solid ${alpha(muiTheme.palette.divider, 0.6)}`, transition: 'transform 0.2s, box-shadow 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 } }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 100, height: 100, flexShrink: 0 }}>
                <ReactApexChart
                  type="radialBar"
                  height={100}
                  series={[Math.min(kpis?.availabilityRate ?? 0, 100)]}
                  options={{
                    ...apexTheme,
                    chart: { ...apexTheme.chart, animations: { enabled: true, speed: 800, dynamicAnimation: { enabled: true } }, sparkline: { enabled: false } },
                    colors: [CHART_COLORS[0]],
                    plotOptions: {
                      radialBar: {
                        hollow: { size: '58%', margin: 4 },
                        track: { background: alpha(CHART_COLORS[0], 0.15), strokeWidth: '100%', margin: 0 },
                        dataLabels: {
                          name: { show: false },
                          value: { show: false }
                        },
                        startAngle: -135,
                        endAngle: 135
                      }
                    },
                    stroke: { lineCap: 'round' }
                  }}
                />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" color="text.secondary" fontWeight={500}>Disponibilité</Typography>
                <Typography variant="h4" fontWeight={800} sx={{ color: CHART_COLORS[0] }}>{kpis?.availabilityRate ?? 0}%</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>{kpis?.operationalCount ?? 0}/{kpis?.totalEquipment ?? 0} équipements</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, overflow: 'hidden', height: '100%', border: `1px solid ${alpha(muiTheme.palette.divider, 0.6)}` }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>Coût période</Typography>
                  <Typography variant="h4" fontWeight={800} sx={{ color: CHART_COLORS[2] }}>{(kpis?.totalCostPeriod ?? 0).toLocaleString('fr-FR')} {currency}</Typography>
                  <Typography variant="caption" color="text.secondary">Pièces + main d'œuvre</Typography>
                </Box>
                <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: alpha(CHART_COLORS[2], 0.15), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Euro sx={{ color: CHART_COLORS[2], fontSize: 24 }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, overflow: 'hidden', height: '100%', border: `1px solid ${alpha(muiTheme.palette.divider, 0.6)}` }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>MTTR / MTBF</Typography>
                  <Typography variant="h5" fontWeight={800} sx={{ color: CHART_COLORS[4] }}>{kpis?.mttr ?? '–'} h</Typography>
                  <Typography variant="caption" color="text.secondary">MTBF {kpis?.mtbf ?? '–'} j</Typography>
                </Box>
                <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: alpha(CHART_COLORS[4], 0.15), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Build sx={{ color: CHART_COLORS[4], fontSize: 24 }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, overflow: 'hidden', height: '100%', border: `1px solid ${alpha(muiTheme.palette.divider, 0.6)}` }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>Respect préventif</Typography>
                  <Typography variant="h4" fontWeight={800} sx={{ color: kpis?.preventiveComplianceRate >= 80 ? CHART_COLORS[0] : CHART_COLORS[4] }}>{kpis?.preventiveComplianceRate ?? 100}%</Typography>
                  <LinearProgress variant="determinate" value={Math.min(kpis?.preventiveComplianceRate ?? 100, 100)} sx={{ mt: 0.5, height: 6, borderRadius: 1, bgcolor: alpha(muiTheme.palette.primary.main, 0.1), '& .MuiLinearProgress-bar': { bgcolor: CHART_COLORS[0] } }} />
                </Box>
                <Schedule sx={{ color: CHART_COLORS[0], fontSize: 28, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      )}

      {/* Indicateurs période — bandeau compact */}
      {visibleOrder.includes('summary') && (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
        {[
          { label: 'OT créés', value: summary?.workOrdersCreatedPeriod ?? 0, icon: AddTask, color: CHART_COLORS[2] },
          { label: 'OT terminés', value: summary?.workOrdersCompletedPeriod ?? 0, icon: Build, color: CHART_COLORS[0] },
          { label: 'Interventions', value: summary?.interventionsCount ?? 0, sub: summary?.interventionsHours ? `${summary.interventionsHours} h` : null, icon: Timeline, color: CHART_COLORS[3] },
          { label: 'OT en retard (SLA)', value: kpis?.slaBreached ?? 0, icon: Warning, color: (kpis?.slaBreached ?? 0) > 0 ? CHART_COLORS[4] : '#64748b' },
          { label: 'OT actifs', value: charts?.byStatus?.find(s => s.status === 'in_progress')?.count ?? 0, icon: Assignment, color: CHART_COLORS[1] },
          { label: 'Alertes stock', value: summary?.stockAlertsCount ?? 0, icon: Inventory, color: (summary?.stockAlertsCount ?? 0) > 0 ? CHART_COLORS[4] : '#64748b' }
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <Card
            key={label}
            sx={{
              borderRadius: 2,
              minWidth: 120,
              border: `1px solid ${alpha(muiTheme.palette.divider, 0.5)}`,
              bgcolor: alpha(color, 0.06)
            }}
          >
            <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 1 } }}>
              <Box display="flex" alignItems="center" gap={1}>
                <Icon sx={{ fontSize: 20, color }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="body1" fontWeight={700} sx={{ color }}>{value}</Typography>
                  {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
      )}

      {/* Accès rapide — grille visuelle */}
      {visibleOrder.includes('summary') && summary && (
        <Card sx={{ borderRadius: 2, mb: 3, border: `1px solid ${alpha(muiTheme.palette.divider, 0.6)}`, overflow: 'hidden' }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <LinkIcon sx={{ color: 'primary.main' }} /> Accès rapide
            </Typography>
            <Grid container spacing={1.5}>
              {[
                { label: 'Sites', value: summary.sitesCount, path: '/sites', icon: Business, sub: `${summary.lignesCount} lignes` },
                { label: 'Équipements', value: summary.equipmentCount, path: '/equipment', icon: Build, sub: `${summary.equipmentOperational} opérationnels` },
                { label: 'OT en attente', value: summary.workOrdersPending, path: '/work-orders?status=pending', icon: Assignment },
                { label: 'OT en cours', value: summary.workOrdersInProgress, path: '/work-orders?status=in_progress', icon: AddTask },
                { label: 'Plans préventifs', value: summary.maintenancePlansActive, path: '/maintenance-plans', icon: Schedule, sub: summary.maintenancePlansOverdue > 0 ? `${summary.maintenancePlansOverdue} en retard` : null },
                { label: 'Stock', value: summary.stockPartsCount, path: '/stock', icon: Inventory, sub: summary.stockAlertsCount > 0 ? `${summary.stockAlertsCount} alerte(s)` : null },
                { label: 'Fournisseurs', value: summary.suppliersCount, path: '/suppliers', icon: People },
                { label: 'Outils', value: summary.toolsCount, path: '/tools', icon: Handyman },
                { label: 'Création', value: null, path: '/creation', icon: Add, sub: 'Nouvel OT, équipement…' },
                { label: 'Rapports', value: null, path: '/reports', icon: Assessment, sub: 'Coûts, disponibilité' }
              ].map(({ label, value, path, icon: Icon, sub }) => (
                <Grid item xs={6} sm={4} md={2} key={label}>
                  <Card
                    sx={{
                      borderRadius: 2,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      border: `1px solid transparent`,
                      '&:hover': { boxShadow: 3, borderColor: 'primary.main', bgcolor: alpha(muiTheme.palette.primary.main, 0.04) }
                    }}
                    onClick={() => navigate(path)}
                  >
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" color="text.secondary">{label}</Typography>
                          <Typography variant="h6" fontWeight={700}>{value ?? '—'}</Typography>
                          {sub && <Typography variant="caption" color="text.secondary" noWrap>{sub}</Typography>}
                        </Box>
                        <Icon sx={{ color: 'primary.main', opacity: 0.9, fontSize: 28 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Répartition OT par Site / Département / Ligne / Équipement */}
      {visibleOrder.includes('woByEntity') && woByEntity && (
        <Card sx={{ borderRadius: 2, mb: 3, border: `1px solid ${alpha(muiTheme.palette.divider, 0.6)}`, overflow: 'hidden' }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Assignment sx={{ color: 'primary.main' }} />
              Répartition des OT par statut
            </Typography>
            <Tabs value={woByEntityTab} onChange={(_, v) => setWoByEntityTab(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tab icon={<LocationOn />} iconPosition="start" label="Par site" />
              <Tab icon={<Category />} iconPosition="start" label="Par département" />
              <Tab icon={<ViewList />} iconPosition="start" label="Par ligne" />
              <Tab icon={<PrecisionManufacturing />} iconPosition="start" label="Par équipement" />
            </Tabs>
            <TableContainer sx={{ maxHeight: 380 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>{woByEntityTab === 0 ? 'Site' : woByEntityTab === 1 ? 'Département' : woByEntityTab === 2 ? 'Ligne' : 'Équipement'}</TableCell>
                    {woByEntityTab === 1 && <TableCell sx={{ fontWeight: 600 }}>Site</TableCell>}
                    {woByEntityTab === 2 && <TableCell sx={{ fontWeight: 600 }}>Site</TableCell>}
                    {woByEntityTab === 3 && <TableCell sx={{ fontWeight: 600 }}>Ligne / Départ.</TableCell>}
                    <TableCell align="center" sx={{ fontWeight: 600 }}>{t('status.pending', 'En attente')}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>{t('status.in_progress', 'En cours')}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>{t('status.completed', 'Terminé')}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>{t('status.cancelled', 'Annulé')}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>{t('status.deferred', 'Reporté')}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {woByEntityTab === 0 && (woByEntity.bySite || []).map((row) => (
                    <TableRow key={row.siteId ?? 'na'} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{row.siteName}</Typography>
                        {row.siteCode && <Typography variant="caption" color="text.secondary"> {row.siteCode}</Typography>}
                      </TableCell>
                      <TableCell align="center">{row.pending}</TableCell>
                      <TableCell align="center">{row.in_progress}</TableCell>
                      <TableCell align="center">{row.completed}</TableCell>
                      <TableCell align="center">{row.cancelled}</TableCell>
                      <TableCell align="center">{row.deferred}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>{row.total}</TableCell>
                    </TableRow>
                  ))}
                  {woByEntityTab === 1 && (woByEntity.byDepartment || []).map((row) => (
                    <TableRow key={row.departmentId} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{row.departmentName}</Typography>
                        {row.departmentCode && <Typography variant="caption" color="text.secondary"> {row.departmentCode}</Typography>}
                      </TableCell>
                      <TableCell>{row.siteName || '—'}</TableCell>
                      <TableCell align="center">{row.pending}</TableCell>
                      <TableCell align="center">{row.in_progress}</TableCell>
                      <TableCell align="center">{row.completed}</TableCell>
                      <TableCell align="center">{row.cancelled}</TableCell>
                      <TableCell align="center">{row.deferred}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>{row.total}</TableCell>
                    </TableRow>
                  ))}
                  {woByEntityTab === 2 && (woByEntity.byLigne || []).map((row) => (
                    <TableRow key={row.ligneId} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{row.ligneName}</Typography>
                        {row.ligneCode && <Typography variant="caption" color="text.secondary"> {row.ligneCode}</Typography>}
                      </TableCell>
                      <TableCell>{row.siteName || '—'}</TableCell>
                      <TableCell align="center">{row.pending}</TableCell>
                      <TableCell align="center">{row.in_progress}</TableCell>
                      <TableCell align="center">{row.completed}</TableCell>
                      <TableCell align="center">{row.cancelled}</TableCell>
                      <TableCell align="center">{row.deferred}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>{row.total}</TableCell>
                    </TableRow>
                  ))}
                  {woByEntityTab === 3 && (woByEntity.byEquipment || []).map((row) => (
                    <TableRow key={row.equipmentId} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/app/equipment/${row.equipmentId}`)}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{row.equipmentCode} {row.equipmentName}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{[row.ligneName, row.departmentName].filter(Boolean).join(' / ') || '—'}</Typography>
                      </TableCell>
                      <TableCell align="center">{row.pending}</TableCell>
                      <TableCell align="center">{row.in_progress}</TableCell>
                      <TableCell align="center">{row.completed}</TableCell>
                      <TableCell align="center">{row.cancelled}</TableCell>
                      <TableCell align="center">{row.deferred}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>{row.total}</TableCell>
                    </TableRow>
                  ))}
                  {woByEntityTab === 0 && (woByEntity.bySite || []).length === 0 && (
                    <TableRow><TableCell colSpan={7} align="center" sx={{ color: 'text.secondary' }}>Aucune donnée</TableCell></TableRow>
                  )}
                  {woByEntityTab === 1 && (woByEntity.byDepartment || []).length === 0 && (
                    <TableRow><TableCell colSpan={8} align="center" sx={{ color: 'text.secondary' }}>Aucune donnée (ou table départements absente)</TableCell></TableRow>
                  )}
                  {woByEntityTab === 2 && (woByEntity.byLigne || []).length === 0 && (
                    <TableRow><TableCell colSpan={8} align="center" sx={{ color: 'text.secondary' }}>Aucune donnée</TableCell></TableRow>
                  )}
                  {woByEntityTab === 3 && (woByEntity.byEquipment || []).length === 0 && (
                    <TableRow><TableCell colSpan={8} align="center" sx={{ color: 'text.secondary' }}>Aucune donnée</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            {(woByEntity.byEquipment || []).length >= 50 && woByEntityTab === 3 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Top 50 équipements par nombre d'OT. Voir la liste complète dans Ordres de travail.</Typography>
            )}
          </CardContent>
        </Card>
      )}

      {/* Graphiques — ligne 1 */}
      {visibleOrder.includes('charts') && (
      <Grid container spacing={3}>
        <Grid item xs={12} lg={6}>
          <Card sx={{ borderRadius: 2, border: `1px solid ${alpha(muiTheme.palette.divider, 0.6)}`, overflow: 'hidden', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 4 } }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>OT par statut</Typography>
              <Box sx={{ height: 280 }}>
                <ReactApexChart
                  type="bar"
                  height={280}
                  series={[{ name: 'OT', data: byStatusData.map((d) => d.count) }]}
                  options={{
                    ...apexTheme,
                    chart: { ...apexTheme.chart, animations: { enabled: true, speed: 600, dynamicAnimation: { enabled: true } }, toolbar: { show: false } },
                    colors: [CHART_COLORS[0]],
                    plotOptions: {
                      bar: {
                        borderRadius: 8,
                        columnWidth: '55%',
                        distributed: false,
                        dataLabels: { position: 'top' }
                      }
                    },
                    dataLabels: { enabled: true, formatter: (v) => v, style: { fontSize: '11px' } },
                    xaxis: { categories: byStatusData.map((d) => d.label), ...apexTheme.xaxis, labels: { rotate: -15, style: { fontSize: '11px' } } },
                    yaxis: { ...apexTheme.yaxis, tickAmount: 5, forceNiceScale: true },
                    grid: { ...apexTheme.grid, xaxis: { lines: { show: false } }, padding: { top: 12, right: 12, left: 0, bottom: 8 } },
                    tooltip: { ...apexTheme.tooltip, y: { formatter: (v) => `${v} OT` } }
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Card sx={{ borderRadius: 2, border: `1px solid ${alpha(muiTheme.palette.divider, 0.6)}`, overflow: 'hidden', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 4 } }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Priorités (en attente)</Typography>
              <Box sx={{ height: 280 }}>
                <ReactApexChart
                  type="donut"
                  height={280}
                  series={byPriorityData.map((d) => d.value)}
                  options={{
                    ...apexTheme,
                    chart: { ...apexTheme.chart, animations: { enabled: true, speed: 700, dynamicAnimation: { enabled: true } } },
                    colors: byPriorityData.map((d) => d.fill),
                    labels: byPriorityData.map((d) => d.name),
                    legend: { ...apexTheme.legend, position: 'right', fontSize: '12px' },
                    plotOptions: {
                      pie: {
                        donut: {
                          size: '65%',
                          labels: {
                            show: true,
                            total: { show: true, label: 'Total', formatter: () => byPriorityData.reduce((s, d) => s + d.value, 0).toString() },
                            value: { fontSize: '18px', fontWeight: 700 }
                          }
                        }
                      }
                    },
                    stroke: { show: true, width: 2, colors: [isDark ? 'rgba(30,41,59,0.9)' : '#fff'] },
                    dataLabels: { enabled: true, formatter: (v, { seriesIndex }) => `${byPriorityData[seriesIndex]?.name ?? ''}: ${v}` },
                    tooltip: { ...apexTheme.tooltip, y: { formatter: (v) => `${v} OT` } }
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Évolution des OT — courbes par statut (lignes) */}
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 2, border: `1px solid ${alpha(muiTheme.palette.divider, 0.6)}`, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <CardContent sx={{ pb: 0 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2} sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Timeline sx={{ color: 'primary.main', fontSize: 28 }} />
                    Évolution des OT
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Nombre d’OT par statut par période (les {period} derniers jours)
                    {areaEvolutionData.length > 0 && (
                      <> · Total : <strong>{areaEvolutionData.reduce((s, r) => s + (r.total || 0), 0)}</strong> OT</>
                    )}
                  </Typography>
                </Box>
                {weeks.length > 0 && (
                  <Chip size="small" label={`${weeks.length} période${weeks.length > 1 ? 's' : ''}`} sx={{ fontWeight: 600 }} variant="outlined" />
                )}
              </Box>
              {weeks.length > 0 ? (
                <Box sx={{ height: 340 }}>
                  <ReactApexChart
                    type="line"
                    height={340}
                    series={statuses.map((status) => ({
                      name: t(`status.${status}`, status),
                      data: areaEvolutionData.map((r) => r[status] ?? 0)
                    }))}
                    options={{
                      ...apexTheme,
                      chart: {
                        ...apexTheme.chart,
                        zoom: { enabled: true, type: 'x' },
                        animations: { enabled: true, speed: 500, dynamicAnimation: { enabled: true } },
                        toolbar: { show: true, tools: { download: true, zoom: true, zoomin: true, zoomout: true, reset: true } }
                      },
                      colors: statuses.map((_, i) => CHART_COLORS[i]),
                      stroke: { curve: 'smooth', width: 2.5 },
                      markers: { size: 4, hover: { size: 6 } },
                      xaxis: {
                        categories: areaEvolutionData.map((r) => formatWeekLabel(r.week)),
                        ...apexTheme.xaxis,
                        labels: { rotate: -25, style: { fontSize: '11px' } },
                        tickAmount: Math.min(weeks.length, 12)
                      },
                      yaxis: { ...apexTheme.yaxis, tickAmount: 5, min: 0, forceNiceScale: true },
                      grid: { ...apexTheme.grid, padding: { top: 16, right: 16, left: 8, bottom: 24 }, strokeDashArray: 3 },
                      legend: { ...apexTheme.legend, position: 'top', horizontalAlign: 'right' },
                      tooltip: {
                        ...apexTheme.tooltip,
                        x: { formatter: (_, { dataPointIndex }) => `Période ${formatWeekLabel(areaEvolutionData[dataPointIndex]?.week)}` },
                        y: { formatter: (v) => `${v} OT` },
                        shared: true,
                        intersect: false
                      }
                    }}
                  />
                </Box>
              ) : (
                <Box sx={{ py: 8, textAlign: 'center' }}>
                  <Timeline sx={{ fontSize: 56, color: 'text.disabled', mb: 1.5, opacity: 0.5 }} />
                  <Typography color="text.secondary">Aucune donnée sur la période sélectionnée</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Interventions par type */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2, border: `1px solid ${alpha(muiTheme.palette.divider, 0.6)}`, overflow: 'hidden', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 4 } }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Interventions par type (30 j)</Typography>
              {byTypeData.length > 0 ? (
                <Box sx={{ height: 280 }}>
                  <ReactApexChart
                    type="bar"
                    height={280}
                    series={[{ name: 'Nombre', data: byTypeData.map((d) => d.count) }]}
                    options={{
                      ...apexTheme,
                      chart: { ...apexTheme.chart, animations: { enabled: true, speed: 600 }, toolbar: { show: false } },
                      colors: byTypeData.map((d) => d.fill),
                      plotOptions: {
                        bar: {
                          horizontal: true,
                          borderRadius: 6,
                          barHeight: '70%',
                          distributed: true,
                          dataLabels: { position: 'bottom', formatter: (v) => v }
                        }
                      },
                      dataLabels: { enabled: true },
                      xaxis: { categories: byTypeData.map((d) => d.name), ...apexTheme.xaxis, labels: { style: { fontSize: '11px' } } },
                      yaxis: { ...apexTheme.yaxis, labels: { maxWidth: 100 } },
                      grid: { ...apexTheme.grid, padding: { top: 8, right: 16, left: 8, bottom: 8 } },
                      tooltip: { ...apexTheme.tooltip, y: { formatter: (v) => `${v} intervention(s)` } },
                      legend: { show: false }
                    }}
                  />
                </Box>
              ) : (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <Assessment sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">Aucune donnée</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        {visibleOrder.includes('technicianPerformance') && (
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2, border: `1px solid ${alpha(muiTheme.palette.divider, 0.6)}`, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <People sx={{ color: 'info.main', fontSize: 26 }} />
                    Performance des techniciens
                  </Typography>
                  <Typography variant="body2" color="text.secondary">OT complétés et heures sur les {period} derniers jours</Typography>
                </Box>
                <Button size="small" endIcon={<ArrowForward />} onClick={() => navigate('/app/reports?tab=technician')} sx={{ textTransform: 'none', fontWeight: 600 }}>
                  Rapport
                </Button>
              </Box>
              {technicianPerformance.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <People sx={{ fontSize: 48, color: 'text.disabled', mb: 1, opacity: 0.5 }} />
                  <Typography color="text.secondary">Aucune intervention enregistrée sur la période</Typography>
                </Box>
              ) : (
                <Box sx={{ height: 280 }}>
                  <ReactApexChart
                    type="bar"
                    height={280}
                    series={[
                      { name: 'OT complétés', data: technicianPerformance.map((t) => t.completed_wo_count ?? 0) },
                      { name: 'Heures', data: technicianPerformance.map((t) => parseFloat(t.hours_spent || 0)) }
                    ]}
                    options={{
                      ...apexTheme,
                      chart: { ...apexTheme.chart, stacked: false, animations: { enabled: true, speed: 600 }, toolbar: { show: false } },
                      colors: [CHART_COLORS[0], CHART_COLORS[3]],
                      plotOptions: {
                        bar: {
                          horizontal: true,
                          borderRadius: 6,
                          barHeight: '65%',
                          columnWidth: '75%'
                        }
                      },
                      xaxis: { categories: technicianPerformance.map((t) => (t.technician_name || 'Technicien').slice(0, 18)), ...apexTheme.xaxis, tickAmount: 6 },
                      yaxis: { ...apexTheme.yaxis, labels: { maxWidth: 100 } },
                      grid: { ...apexTheme.grid, padding: { top: 8, right: 24, left: 8, bottom: 8 } },
                      legend: { ...apexTheme.legend, position: 'top', horizontalAlign: 'right' },
                      tooltip: {
                        ...apexTheme.tooltip,
                        y: [
                          { formatter: (v) => `${v} OT` },
                          { formatter: (v) => `${Number(v).toFixed(1)} h` }
                        ]
                      }
                    }}
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        )}
        {visibleOrder.includes('analytics') && analytics && (
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2, border: `1px solid ${alpha(muiTheme.palette.divider, 0.6)}`, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Assessment sx={{ color: 'primary.main', fontSize: 26 }} />
                BI : Coûts par équipement
              </Typography>
              {(analytics.costsByEquipment || []).length === 0 ? (
                <Typography color="text.secondary">Aucun coût sur la période</Typography>
              ) : (
                <Box sx={{ height: 280 }}>
                  <ReactApexChart
                    type="bar"
                    height={280}
                    series={[{ name: 'Coût total', data: (analytics.costsByEquipment || []).map((e) => Number(e.totalCost ?? 0)) }]}
                    options={{
                      ...apexTheme,
                      chart: { ...apexTheme.chart, animations: { enabled: true, speed: 600 }, toolbar: { show: false } },
                      colors: [CHART_COLORS[2]],
                      plotOptions: {
                        bar: {
                          horizontal: true,
                          borderRadius: 6,
                          barHeight: '70%',
                          dataLabels: { position: 'bottom' }
                        }
                      },
                      dataLabels: { enabled: true, formatter: (v) => `${Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${currency}` },
                      xaxis: {
                        categories: (analytics.costsByEquipment || []).map((e) => (e.code || e.name || '').slice(0, 14)),
                        ...apexTheme.xaxis,
                        labels: { formatter: (v) => `${Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${currency}` }
                      },
                      yaxis: { ...apexTheme.yaxis, labels: { maxWidth: 90 } },
                      grid: { ...apexTheme.grid, padding: { top: 8, right: 24, left: 8, bottom: 8 } },
                      tooltip: { ...apexTheme.tooltip, y: { formatter: (v) => `${Number(v).toFixed(2)} ${currency}` } },
                      legend: { show: false }
                    }}
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        )}
        {visibleOrder.includes('topFailures') && (
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2, border: `1px solid ${alpha(muiTheme.palette.divider, 0.6)}`, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BugReport sx={{ color: 'warning.main', fontSize: 26 }} />
                    Équipements les plus en panne
                  </Typography>
                  <Typography variant="body2" color="text.secondary">Sur les 90 derniers jours</Typography>
                </Box>
                <Button size="small" endIcon={<ArrowForward />} onClick={() => navigate('/app/equipment')} sx={{ textTransform: 'none', fontWeight: 600 }}>
                  Voir tout
                </Button>
              </Box>
              {topFailures.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <BugReport sx={{ fontSize: 48, color: 'text.disabled', mb: 1, opacity: 0.5 }} />
                  <Typography color="text.secondary">Aucune intervention enregistrée sur la période</Typography>
                </Box>
              ) : (
                <Box display="flex" flexDirection="column" gap={1.5}>
                  {topFailures.map((e, idx) => {
                    const maxCount = Math.max(...topFailures.map(x => x.failure_count || 0), 1);
                    const pct = Math.round((e.failure_count / maxCount) * 100);
                    const rankStyle = idx === 0 ? { bgcolor: '#f59e0b', color: '#fff' } : idx === 1 ? { bgcolor: '#94a3b8', color: '#fff' } : idx === 2 ? { bgcolor: '#b45309', color: '#fff' } : { bgcolor: alpha(muiTheme.palette.primary.main, 0.12), color: 'primary.main' };
                    return (
                      <Box
                        key={e.id}
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: alpha(muiTheme.palette.background.paper, 0.8),
                          border: `1px solid ${alpha(muiTheme.palette.divider, 0.4)}`,
                          cursor: 'pointer',
                          transition: 'all 0.25s ease',
                          '&:hover': {
                            bgcolor: alpha(muiTheme.palette.warning.main, 0.06),
                            borderColor: alpha(muiTheme.palette.warning.main, 0.3),
                            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                          }
                        }}
                        onClick={() => navigate(`/app/equipment/${e.id}`)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                          <Box sx={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...rankStyle }}>
                            <Typography variant="caption" fontWeight={800}>{idx + 1}</Typography>
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600} noWrap>{e.code}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap display="block">{e.name}</Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                            <Typography variant="body1" fontWeight={700} color="warning.dark">{e.failure_count}</Typography>
                            <Typography variant="caption" color="text.secondary">interv.</Typography>
                          </Box>
                        </Box>
                        <Box sx={{ height: 8, borderRadius: 1, bgcolor: alpha(muiTheme.palette.warning.main, 0.2), overflow: 'hidden' }}>
                          <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: 'warning.main', borderRadius: 1, transition: 'width 0.5s ease' }} />
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        )}

        {/* Activité récente — timeline */}
        {visibleOrder.includes('recent') && (
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 2, border: `1px solid ${alpha(muiTheme.palette.divider, 0.6)}`, overflow: 'hidden' }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={700}>Activité récente</Typography>
                <Chip label="Voir tous les OT" size="small" onClick={() => navigate('/app/work-orders')} sx={{ cursor: 'pointer' }} variant="outlined" icon={<ArrowForward sx={{ fontSize: 16 }} />} />
              </Box>
              {recent.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <Assignment sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">Aucun ordre de travail récent</Typography>
                </Box>
              ) : (
                <Box display="flex" flexDirection="column" gap={0}>
                  {recent.map((wo, idx) => (
                    <Box
                      key={wo.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        py: 1.5,
                        px: 1,
                        borderBottom: idx < recent.length - 1 ? 1 : 0,
                        borderColor: 'divider',
                        cursor: 'pointer',
                        borderRadius: 1,
                        transition: 'background 0.2s',
                        '&:hover': { bgcolor: alpha(muiTheme.palette.primary.main, 0.06) }
                      }}
                      onClick={() => navigate(`/app/work-orders/${wo.id}`)}
                    >
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: statusColors[wo.status] ? `${statusColors[wo.status]}.main` : 'grey.500' }} />
                      <Typography variant="body2" fontWeight={600} sx={{ minWidth: 90 }}>{wo.number}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }} noWrap>{wo.title}</Typography>
                      {wo.equipment_name && <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 120 }}>{wo.equipment_name}</Typography>}
                      <Typography variant="caption" color="text.secondary">{formatRelative(wo.created_at)}</Typography>
                      <Chip label={t(`status.${wo.status}`, wo.status)} size="small" color={statusColors[wo.status] || 'default'} sx={{ fontWeight: 600 }} />
                      <Chip label={t(`priority.${wo.priority}`, wo.priority)} size="small" variant="outlined" />
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        )}
      </Grid>
      )}
    </Box>
  );
}
