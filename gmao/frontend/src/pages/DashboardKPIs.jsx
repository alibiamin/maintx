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

export default function DashboardKPIs() {
  const currency = useCurrency();
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const navigate = useNavigate();

  useEffect(() => {
    loadKPIs();
  }, [period]);

  const loadKPIs = async () => {
    try {
      const res = await api.get('/dashboard/kpis', { params: { period } });
      setKpis(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  const availabilityRate = kpis?.availabilityRate ?? 0;
  const preventiveRate = kpis?.preventiveComplianceRate ?? 100;
  const totalCost = kpis?.totalCostPeriod ?? 0;
  const mttr = kpis?.mttr ?? null;

  const kpiCards = [
    { title: 'Disponibilité équipements', value: `${Number(availabilityRate).toFixed(1)}%`, sub: `${kpis?.operationalCount ?? 0}/${kpis?.totalEquipment ?? 0} opérationnels`, icon: Speed, color: 'primary', progress: availabilityRate },
    { title: 'Respect plans préventifs', value: `${Number(preventiveRate).toFixed(1)}%`, sub: 'Plans exécutés à temps', icon: Schedule, color: 'success', progress: preventiveRate },
    { title: 'Coût maintenance (période)', value: `${Number(totalCost).toLocaleString('fr-FR')} ${currency}`, sub: `Pièces : ${(kpis?.partsCost ?? 0).toLocaleString('fr-FR')} ${currency} · Main d'œuvre : ${(kpis?.laborCost ?? 0).toLocaleString('fr-FR')} ${currency}`, icon: Euro, color: 'warning' },
    { title: 'MTTR (temps moyen réparation)', value: mttr != null ? `${Number(mttr).toFixed(1)} h` : '—', sub: 'Heures moyennes par OT terminé', icon: Build, color: 'info' },
    { title: 'MTBF (entre pannes)', value: kpis?.mtbf != null ? `${Number(kpis.mtbf).toFixed(1)} j` : '—', sub: 'Jours moyens entre pannes', icon: TrendingUp, color: 'success' },
    { title: 'OT en retard (SLA)', value: String(kpis?.slaBreached ?? 0), sub: 'À traiter en priorité', icon: Warning, color: (kpis?.slaBreached ?? 0) > 0 ? 'error' : 'default' }
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/')} size="small">Tableau de bord</Button>
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
        <Button startIcon={<BarChart />} variant="outlined" onClick={() => navigate('/reports')}>
          Voir les rapports détaillés
        </Button>
      </Box>
    </Box>
  );
}
