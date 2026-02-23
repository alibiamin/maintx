import React, { useEffect, useState } from 'react';
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
  CircularProgress,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  alpha,
  useTheme
} from '@mui/material';
import {
  Lightbulb,
  Assessment,
  Warning,
  Error as ErrorIcon,
  Info as InfoIcon,
  PriorityHigh,
  TrendingUp
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

const STATUS_COLORS = { ok: 'success', attention: 'warning', critical: 'error' };
const SEVERITY_ICONS = { info: InfoIcon, warning: Warning, critical: ErrorIcon };
const PRIORITY_LABELS = { urgent: 'Urgent', high: 'Priorité haute', medium: 'Priorité moyenne' };

export default function DecisionSupport() {
  const { t } = useTranslation();
  const theme = useTheme();
  const currencyFromContext = useCurrency();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const currency = data?.currency || currencyFromContext;

  useEffect(() => {
    setLoading(true);
    api.get('/dashboard/decision-support', { params: { period } })
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period]);

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
  };

  if (loading && !data) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={320}>
        <CircularProgress />
      </Box>
    );
  }

  const indicators = data?.indicators ?? [];
  const observations = data?.observations ?? [];
  const recommendations = data?.recommendations ?? [];
  const priorities = data?.priorities ?? [];
  const decisionSupport = data?.decisionSupport ?? [];

  const formatIndicatorValue = (ind) => {
    if (ind.value == null) return '—';
    if (typeof ind.value === 'number' && ind.unit === '%') return `${ind.value} %`;
    if (ind.id === 'cost_period' || ind.unit === currency) return `${Number(ind.value).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${currency}`;
    return `${ind.value} ${ind.unit || ''}`.trim();
  };
  const formatTarget = (ind) => {
    if (ind.ref == null && !ind.refLabel) return '—';
    if (ind.ref != null && ind.targetDirection) {
      const u = ind.unit === '%' || ind.unit === 'h' || ind.unit === 'j' || ind.unit === 'OT' ? ind.unit : ind.unit === currency ? currency : ind.unit || '';
      const sep = u ? ` ${u}` : '';
      return ind.targetDirection === 'max' ? `Objectif ≤ ${Number(ind.ref).toLocaleString('fr-FR')}${sep}` : `Objectif ≥ ${ind.ref}${sep}`;
    }
    return ind.refLabel || (ind.ref != null ? String(ind.ref) : '—');
  };

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', py: 3, px: 2 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Lightbulb sx={{ fontSize: 36, color: 'primary.main' }} />
        <Box>
          <Typography variant="h4" fontWeight={800}>
            {t('menu.decisionSupport', 'Assistance et aide à la décision')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Analyse de l'état de la société selon indicateurs normés (EN 15341, bonnes pratiques) — observations, recommandations et aide à la décision pour la direction et les responsables.
          </Typography>
        </Box>
      </Box>

      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary">Période d'analyse :</Typography>
        <ToggleButtonGroup
          value={period}
          exclusive
          onChange={(_, v) => v != null && setPeriod(v)}
          size="small"
        >
          <ToggleButton value={7}>7 jours</ToggleButton>
          <ToggleButton value={30}>30 jours</ToggleButton>
          <ToggleButton value={90}>90 jours</ToggleButton>
        </ToggleButtonGroup>
        {data?.generatedAt && (
          <Typography variant="caption" color="text.secondary">
            Rapport généré le {formatDate(data.generatedAt)}
          </Typography>
        )}
      </Box>

      {/* Aide à la décision — synthèse pour la direction */}
      {decisionSupport.length > 0 && (
        <Card sx={{ mb: 3, borderLeft: 4, borderColor: 'primary.main', borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <PriorityHigh color="primary" /> Aide à la décision (direction et responsables)
            </Typography>
            <List dense disablePadding>
              {decisionSupport.map((item, i) => (
                <ListItem key={i} alignItems="flex-start" sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {item.type === 'alert' && <ErrorIcon color="error" />}
                    {item.type === 'recommendation' && <Lightbulb color="warning.main" />}
                    {item.type === 'action' && <Warning color="warning.main" />}
                    {item.type === 'info' && <InfoIcon color="info.main" />}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    secondary={item.audience && `Cible : ${item.audience}`}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Indicateurs normés */}
      <Card sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assessment color="primary" /> Indicateurs normés (référentiel EN 15341 / bonnes pratiques)
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Indicateur</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Valeur</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Référence / objectif</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Statut</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {indicators.map((ind) => (
                <TableRow key={ind.id} hover>
                  <TableCell>{ind.label}</TableCell>
                  <TableCell align="right">{formatIndicatorValue(ind)}</TableCell>
                  <TableCell>{formatTarget(ind)}</TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={ind.status === 'ok' ? 'OK' : ind.status === 'attention' ? 'Attention' : 'Critique'} color={STATUS_COLORS[ind.status] || 'default'} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {indicators.length === 0 && !loading && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Aucun indicateur disponible.</Typography>
          )}
        </CardContent>
      </Card>

      {/* Observations */}
      <Card sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoIcon color="primary" /> Observations (constats)
          </Typography>
          <List dense disablePadding>
            {observations.map((obs, i) => {
              const Icon = SEVERITY_ICONS[obs.severity] || InfoIcon;
              return (
                <ListItem key={i} alignItems="flex-start" sx={{ py: 0.75, borderLeft: 2, borderColor: obs.severity === 'critical' ? 'error.main' : obs.severity === 'warning' ? 'warning.main' : 'info.main', pl: 2, ml: 0, borderRadius: 1, mb: 0.5, bgcolor: alpha(theme.palette[obs.severity === 'critical' ? 'error' : obs.severity === 'warning' ? 'warning' : 'info'].main, 0.06) }}>
                  <ListItemIcon sx={{ minWidth: 36 }}><Icon color={obs.severity === 'critical' ? 'error' : obs.severity === 'warning' ? 'warning' : 'info'} fontSize="small" /></ListItemIcon>
                  <ListItemText primary={obs.text} primaryTypographyProps={{ variant: 'body2' }} />
                </ListItem>
              );
            })}
          </List>
          {observations.length === 0 && !loading && (
            <Typography variant="body2" color="text.secondary">Aucune observation sur la période.</Typography>
          )}
        </CardContent>
      </Card>

      {/* Recommandations */}
      <Card sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUp color="primary" /> Recommandations d'amélioration
          </Typography>
          <List dense disablePadding>
            {recommendations.map((rec, i) => (
              <ListItem key={i} alignItems="flex-start">
                <ListItemIcon sx={{ minWidth: 36 }}><Lightbulb color="warning.main" fontSize="small" /></ListItemIcon>
                <ListItemText primary={rec.text} secondary={rec.category && `Catégorie : ${rec.category}`} primaryTypographyProps={{ variant: 'body2' }} secondaryTypographyProps={{ variant: 'caption' }} />
              </ListItem>
            ))}
          </List>
          {recommendations.length === 0 && !loading && (
            <Typography variant="body2" color="text.secondary">Aucune recommandation sur la période.</Typography>
          )}
        </CardContent>
      </Card>

      {/* Priorités d'intervention */}
      <Card sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Warning color="primary" /> Priorités d'intervention
          </Typography>
          <List dense disablePadding>
            {priorities.map((p, i) => (
              <ListItem key={i} alignItems="flex-start">
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Chip size="small" label={PRIORITY_LABELS[p.level] || p.level} color={p.level === 'urgent' ? 'error' : p.level === 'high' ? 'warning' : 'default'} />
                </ListItemIcon>
                <ListItemText primary={p.action} secondary={`Domaine : ${p.domain}`} primaryTypographyProps={{ variant: 'body2' }} secondaryTypographyProps={{ variant: 'caption' }} />
              </ListItem>
            ))}
          </List>
          {priorities.length === 0 && !loading && (
            <Typography variant="body2" color="text.secondary">Aucune priorité d'intervention identifiée.</Typography>
          )}
        </CardContent>
      </Card>

      <Typography variant="caption" color="text.secondary" display="block" sx={{ textAlign: 'center', mt: 2 }}>
        Ce rapport est établi à partir des données de la GMAO sur la période sélectionnée. Les seuils de référence s'appuient sur la norme EN 15341 (indicateurs de maintenance) et les bonnes pratiques sectorielles. Il constitue un support pour les revues de direction et le pilotage de la maintenance.
      </Typography>
    </Box>
  );
}
