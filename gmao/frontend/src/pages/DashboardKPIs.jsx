import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  Button,
  LinearProgress
} from '@mui/material';
import { TrendingUp, Build, Euro, Schedule, Speed, Warning, ArrowBack, BarChart } from '@mui/icons-material';
import api from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

const ICON_MAP = { Speed, Schedule, Euro, Build, TrendingUp, Warning };

function formatKpiValue(sourceKey, rawValue, kpis, currency) {
  switch (sourceKey) {
    case 'availabilityRate':
      return { value: `${Number(rawValue ?? 0).toFixed(1)}%`, sub: `${kpis?.operationalCount ?? 0}/${kpis?.totalEquipment ?? 0} opérationnels`, progress: rawValue ?? 0 };
    case 'preventiveComplianceRate':
      return { value: `${Number(rawValue ?? 100).toFixed(1)}%`, sub: 'Plans exécutés à temps', progress: rawValue ?? 100 };
    case 'totalCostPeriod':
      return { value: `${Number(rawValue ?? 0).toLocaleString('fr-FR')} ${currency}`, sub: `Pièces : ${(kpis?.partsCost ?? 0).toLocaleString('fr-FR')} ${currency} · Main d'œuvre : ${(kpis?.laborCost ?? 0).toLocaleString('fr-FR')} ${currency}` };
    case 'mttr':
      return { value: rawValue != null ? `${Number(rawValue).toFixed(1)} h` : '—', sub: 'Heures moyennes par OT terminé' };
    case 'mtbf':
      return { value: rawValue != null ? `${Number(rawValue).toFixed(1)} j` : '—', sub: 'Jours moyens entre pannes' };
    case 'slaBreached':
      return { value: String(rawValue ?? 0), sub: 'À traiter en priorité', colorOverride: (rawValue ?? 0) > 0 ? 'error' : 'default' };
    case 'oee':
      return { value: `${Number(rawValue ?? 0).toFixed(1)}%`, sub: 'OEE (disponibilité)', progress: rawValue ?? 0 };
    default:
      return { value: rawValue != null ? String(rawValue) : '—', sub: '' };
  }
}

const DEFAULT_CARDS = [
  { name: 'Disponibilité équipements', source_key: 'availabilityRate', color: 'primary', icon: 'Speed' },
  { name: 'Respect plans préventifs', source_key: 'preventiveComplianceRate', color: 'success', icon: 'Schedule' },
  { name: 'Coût maintenance (période)', source_key: 'totalCostPeriod', color: 'warning', icon: 'Euro' },
  { name: 'MTTR (temps moyen réparation)', source_key: 'mttr', color: 'info', icon: 'Build' },
  { name: 'MTBF (entre pannes)', source_key: 'mtbf', color: 'success', icon: 'TrendingUp' },
  { name: 'OT en retard (SLA)', source_key: 'slaBreached', color: 'error', icon: 'Warning' }
];

export default function DashboardKPIs() {
  const currency = useCurrency();
  const [kpis, setKpis] = useState(null);
  const [definitions, setDefinitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [kpiRes, defRes] = await Promise.all([
        api.get('/dashboard/kpis', { params: { period } }),
        api.get('/settings/kpi-definitions').catch(() => ({ data: [] }))
      ]);
      setKpis(kpiRes.data);
      setDefinitions(Array.isArray(defRes.data) ? defRes.data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const visibleDefinitions = definitions.length > 0
    ? definitions.filter((d) => d.is_visible !== 0 && d.is_visible !== false).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    : DEFAULT_CARDS.map((d, i) => ({ ...d, order_index: i }));

  const kpiCards = visibleDefinitions.map((def) => {
    const rawValue = kpis?.[def.source_key];
    const formatted = formatKpiValue(def.source_key, rawValue, kpis, currency);
    const IconComponent = ICON_MAP[def.icon] || Speed;
    const color = formatted.colorOverride ?? def.color ?? 'primary';
    return {
      title: def.name,
      value: formatted.value,
      sub: formatted.sub,
      progress: formatted.progress,
      color,
      icon: IconComponent
    };
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/app')} size="small">Tableau de bord</Button>
          <Typography variant="h5" fontWeight={700}>
            Indicateurs de performance (KPIs)
          </Typography>
        </Box>
        <ToggleButtonGroup value={period} exclusive onChange={(_, v) => v != null && setPeriod(v)} size="small">
          <ToggleButton value={7}>7 j</ToggleButton>
          <ToggleButton value={30}>30 j</ToggleButton>
          <ToggleButton value={90}>90 j</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Grid container spacing={3}>
        {kpiCards.map((kpi, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card sx={{ borderRadius: 2, height: '100%' }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>{kpi.title}</Typography>
                    <Typography variant="h4" fontWeight={700}>{kpi.value}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">{kpi.sub}</Typography>
                    {kpi.progress !== undefined && (
                      <LinearProgress variant="determinate" value={Math.min(kpi.progress, 100)} sx={{ mt: 1, height: 6, borderRadius: 2 }} color={kpi.color} />
                    )}
                  </Box>
                  <Box sx={{ color: `${kpi.color}.main`, opacity: 0.4 }}>{<kpi.icon />}</Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Box mt={3}>
        <Button startIcon={<BarChart />} variant="outlined" onClick={() => navigate('/app/reports')}>
          Voir les rapports détaillés
        </Button>
        <Button variant="outlined" sx={{ ml: 2 }} onClick={() => navigate('/app/settings?tab=kpis')}>
          Personnaliser les indicateurs
        </Button>
      </Box>
    </Box>
  );
}
