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
  alpha
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
  NotificationsActive
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
  RadialBarChart,
  RadialBar,
  LineChart,
  Line,
  ComposedChart
} from 'recharts';
import api from '../services/api';
import { useTheme } from '@mui/material/styles';
import { useCurrency } from '../context/CurrencyContext';
import { CHART_COLORS } from '../shared/chartTheme';

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

// Labels statuts français
const STATUS_LABELS = { pending: 'En attente', in_progress: 'En cours', completed: 'Terminé', cancelled: 'Annulé', deferred: 'Reporté' };
const PRIORITY_LABELS = { low: 'Basse', medium: 'Moyenne', high: 'Haute', critical: 'Critique' };

export default function Dashboard() {
  const [kpis, setKpis] = useState(null);
  const [charts, setCharts] = useState(null);
  const [recent, setRecent] = useState([]);
  const [alerts, setAlerts] = useState({ stock: [], sla: [], overduePlans: [] });
  const [topFailures, setTopFailures] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const navigate = useNavigate();
  const muiTheme = useTheme();
  const currency = useCurrency();
  const isDark = muiTheme.palette.mode === 'dark';
  const tickStyle = { fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 };
  const tooltipBg = isDark ? 'rgba(30, 41, 59, 0.98)' : 'rgba(255,255,255,0.98)';
  const tooltipBorder = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(0,0,0,0.08)';

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/dashboard/kpis', { params: { period } }),
      api.get('/dashboard/charts'),
      api.get('/dashboard/recent'),
      api.get('/dashboard/alerts').catch(() => ({ data: { stock: [], sla: [], overduePlans: [] } })),
      api.get('/dashboard/top-failures', { params: { limit: 5 } }).catch(() => ({ data: [] })),
      api.get('/dashboard/summary', { params: { period } }).catch(() => ({ data: null }))
    ]).then(([k, c, r, a, t, s]) => {
      setKpis(k.data);
      setCharts(c.data);
      setRecent(r.data);
      setAlerts(a.data);
      setTopFailures(t.data || []);
      setSummary(s.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [period]);

  const statusColors = { pending: 'warning', in_progress: 'info', completed: 'success', cancelled: 'default', deferred: 'default' };
  const byStatusData = (charts?.byStatus || []).map(s => ({ ...s, label: STATUS_LABELS[s.status] || s.status }));
  const byPriorityData = (charts?.byPriority || []).map((p, i) => ({ name: PRIORITY_LABELS[p.priority] || p.priority, value: p.count, fill: CHART_COLORS[i % CHART_COLORS.length] }));
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

  // Données pour jauge radiale (Disponibilité / OEE)
  const radialData = [
    { name: 'Dispo', value: Math.min(kpis?.availabilityRate ?? 0, 100), fill: CHART_COLORS[0] },
    { name: 'OEE', value: Math.min(kpis?.oee ?? 0, 100), fill: CHART_COLORS[2] }
  ];

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

      {/* Alertes — bandeau compact */}
      {(alerts.stock?.length > 0 || alerts.sla?.length > 0 || alerts.overduePlans?.length > 0) && (
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
                  onClick={() => navigate('/stock/alerts')}
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
                  onClick={() => navigate('/work-orders')}
                >
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="body2" fontWeight={600}>SLA dépassé</Typography>
                    <Typography variant="caption" color="text.secondary">{alerts.sla.length} OT en retard</Typography>
                    <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {alerts.sla.slice(0, 3).map(wo => (
                        <Chip key={wo.id} label={wo.number} size="small" onClick={(e) => { e.stopPropagation(); navigate(`/work-orders/${wo.id}`); }} sx={{ cursor: 'pointer', height: 24 }} />
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
                  onClick={() => navigate('/maintenance-plans/due')}
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
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, overflow: 'hidden', height: '100%', border: `1px solid ${alpha(muiTheme.palette.divider, 0.6)}` }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 80, height: 80, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ ...radialData[0], value: Math.min(radialData[0].value, 100) }]} startAngle={180} endAngle={0}>
                    <RadialBar background dataKey="value" cornerRadius={8} />
                  </RadialBarChart>
                </ResponsiveContainer>
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

      {/* Indicateurs période — bandeau compact */}
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

      {/* Accès rapide — grille visuelle */}
      {summary && (
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

      {/* Graphiques — ligne 1 */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={6}>
          <Card sx={{ borderRadius: 2, border: `1px solid ${alpha(muiTheme.palette.divider, 0.6)}`, overflow: 'hidden' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>OT par statut</Typography>
              <Box sx={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byStatusData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                    <defs>
                      <linearGradient id="barGradientMain" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={1} />
                        <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0.7} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={tickStyle} tickLine={false} />
                    <YAxis tick={tickStyle} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${tooltipBorder}`, backgroundColor: tooltipBg, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} formatter={(v) => [v, 'OT']} />
                    <Bar dataKey="count" name="OT" fill="url(#barGradientMain)" radius={[8, 8, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Card sx={{ borderRadius: 2, border: `1px solid ${alpha(muiTheme.palette.divider, 0.6)}`, overflow: 'hidden' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Priorités (en attente)</Typography>
              <Box sx={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      {byPriorityData.map((_, i) => (
                        <linearGradient key={i} id={`pieGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={byPriorityData[i].fill} stopOpacity={1} />
                          <stop offset="100%" stopColor={byPriorityData[i].fill} stopOpacity={0.75} />
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie
                      data={byPriorityData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={72}
                      outerRadius={100}
                      paddingAngle={3}
                      stroke={isDark ? 'rgba(30,41,59,0.9)' : '#fff'}
                      strokeWidth={2}
                    >
                      {byPriorityData.map((_, i) => (
                        <Cell key={i} fill={`url(#pieGrad${i})`} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${tooltipBorder}`, backgroundColor: tooltipBg }} formatter={(v, name) => [v, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Évolution des OT — graphique zone avec dégradé */}
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 2, border: `1px solid ${alpha(muiTheme.palette.divider, 0.6)}`, overflow: 'hidden' }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={700}>
                  <Timeline sx={{ verticalAlign: 'middle', mr: 1, color: 'primary.main' }} />
                  Évolution des OT ({period} jours)
                </Typography>
              </Box>
              {weeks.length > 0 ? (
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={areaEvolutionData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                      <defs>
                        {statuses.map((_, i) => (
                          <linearGradient key={i} id={`areaGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CHART_COLORS[i]} stopOpacity={0.5} />
                            <stop offset="100%" stopColor={CHART_COLORS[i]} stopOpacity={0.05} />
                          </linearGradient>
                        ))}
                      </defs>
                      <XAxis dataKey="week" tick={tickStyle} tickLine={false} />
                      <YAxis tick={tickStyle} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${tooltipBorder}`, backgroundColor: tooltipBg }} />
                      <Legend formatter={(v) => STATUS_LABELS[v] || v} />
                      {statuses.map((status, i) => (
                        <Area key={status} type="monotone" dataKey={status} stackId="1" stroke={CHART_COLORS[i]} strokeWidth={2} fill={`url(#areaGrad${i})`} />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <Timeline sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">Aucune donnée sur la période</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Interventions par type + Top pannes */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2, border: `1px solid ${alpha(muiTheme.palette.divider, 0.6)}`, overflow: 'hidden' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Interventions par type (30 j)</Typography>
              {byTypeData.length > 0 ? (
                <Box sx={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={byTypeData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                      <XAxis type="number" tick={tickStyle} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={90} tick={{ ...tickStyle, fontSize: 11 }} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${tooltipBorder}`, backgroundColor: tooltipBg }} />
                      <Bar dataKey="count" name="Nombre" radius={[0, 8, 8, 0]} maxBarSize={28}>
                        {byTypeData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
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
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2, border: `1px solid ${alpha(muiTheme.palette.divider, 0.6)}`, overflow: 'hidden' }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={700}>Équipements les plus en panne (90 j)</Typography>
                <Chip label="Voir tout" size="small" onClick={() => navigate('/equipment')} sx={{ cursor: 'pointer' }} variant="outlined" icon={<ArrowForward sx={{ fontSize: 16 }} />} />
              </Box>
              {topFailures.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <BugReport sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">Aucune donnée</Typography>
                </Box>
              ) : (
                <Box display="flex" flexDirection="column" gap={1.5}>
                  {topFailures.map((e, idx) => {
                    const maxCount = topFailures[0]?.failure_count || 1;
                    const pct = (e.failure_count / maxCount) * 100;
                    return (
                      <Box
                        key={e.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          p: 1.25,
                          borderRadius: 1.5,
                          bgcolor: alpha(muiTheme.palette.warning.main, 0.06),
                          border: `1px solid ${alpha(muiTheme.palette.warning.main, 0.2)}`,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          '&:hover': { bgcolor: alpha(muiTheme.palette.warning.main, 0.12) }
                        }}
                        onClick={() => navigate(`/equipment/${e.id}`)}
                      >
                        <Typography variant="body2" fontWeight={700} color="text.secondary" sx={{ minWidth: 20 }}>#{idx + 1}</Typography>
                        <BugReport sx={{ fontSize: 20, color: 'warning.main' }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>{e.code}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>{e.name}</Typography>
                        </Box>
                        <Box sx={{ width: 60, textAlign: 'right' }}>
                          <Typography variant="body2" fontWeight={700} color="warning.main">{e.failure_count}</Typography>
                          <Typography variant="caption" color="text.secondary">interv.</Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={pct} sx={{ width: 48, height: 6, borderRadius: 1, bgcolor: alpha(muiTheme.palette.warning.main, 0.2), '& .MuiLinearProgress-bar': { bgcolor: 'warning.main' } }} />
                      </Box>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Activité récente — timeline */}
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 2, border: `1px solid ${alpha(muiTheme.palette.divider, 0.6)}`, overflow: 'hidden' }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={700}>Activité récente</Typography>
                <Chip label="Voir tous les OT" size="small" onClick={() => navigate('/work-orders')} sx={{ cursor: 'pointer' }} variant="outlined" icon={<ArrowForward sx={{ fontSize: 16 }} />} />
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
                      onClick={() => navigate(`/work-orders/${wo.id}`)}
                    >
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: statusColors[wo.status] ? `${statusColors[wo.status]}.main` : 'grey.500' }} />
                      <Typography variant="body2" fontWeight={600} sx={{ minWidth: 90 }}>{wo.number}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }} noWrap>{wo.title}</Typography>
                      {wo.equipment_name && <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 120 }}>{wo.equipment_name}</Typography>}
                      <Typography variant="caption" color="text.secondary">{formatRelative(wo.created_at)}</Typography>
                      <Chip label={STATUS_LABELS[wo.status] || wo.status} size="small" color={statusColors[wo.status] || 'default'} sx={{ fontWeight: 600 }} />
                      <Chip label={PRIORITY_LABELS[wo.priority] || wo.priority} size="small" variant="outlined" />
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
