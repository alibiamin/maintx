import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  LinearProgress,
  alpha,
  Button,
  useTheme
} from '@mui/material';
import {
  Warning,
  Error as ErrorIcon,
  Inventory2,
  ShoppingCart,
  ArrowForward,
  CheckCircle
} from '@mui/icons-material';
import api from '../../services/api';

function normalizeAlert(row) {
  const current = row.stock_quantity ?? row.currentStock ?? 0;
  const min = row.min_stock ?? row.minStock ?? 0;
  const isCritical = current === 0;
  return {
    id: row.id,
    code: row.code,
    name: row.name ?? row.partName ?? '—',
    currentStock: current,
    minStock: min,
    unit: row.unit ?? 'unité',
    alertType: row.alertType ?? (isCritical ? 'critical' : 'warning'),
    priority: row.priority ?? (isCritical ? 'Haute' : 'Moyenne')
  };
}

export default function StockAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const theme = useTheme();

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const res = await api.get('/stock/alerts');
      const rows = res.data || [];
      setAlerts(rows.map(normalizeAlert));
    } catch (error) {
      console.error(error);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const criticalCount = alerts.filter((a) => a.alertType === 'critical' || a.currentStock === 0).length;
  const warningCount = alerts.length - criticalCount;

  return (
    <Box sx={{ pb: 4 }}>
      {/* En-tête */}
      <Box
        sx={{
          borderRadius: 3,
          mb: 3,
          p: { xs: 2, md: 3 },
          background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.12)} 0%, ${alpha(theme.palette.error.main, 0.06)} 100%)`,
          border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.warning.main, 0.2),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Inventory2 sx={{ fontSize: 32, color: 'warning.main' }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={800} letterSpacing="-0.02em" sx={{ mb: 0.5 }}>
              Alertes de stock
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Pièces sous le seuil minimum. Une demande d&apos;approvisionnement est créée automatiquement pour chaque alerte.
            </Typography>
          </Box>
        </Box>
        {!loading && alerts.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {criticalCount > 0 && (
              <Chip
                icon={<ErrorIcon />}
                label={`${criticalCount} rupture${criticalCount > 1 ? 's' : ''}`}
                color="error"
                sx={{ fontWeight: 600 }}
              />
            )}
            {warningCount > 0 && (
              <Chip
                icon={<Warning />}
                label={`${warningCount} sous seuil`}
                color="warning"
                sx={{ fontWeight: 600 }}
              />
            )}
          </Box>
        )}
      </Box>

      {/* Résumé rapide */}
      {!loading && alerts.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Card
            sx={{
              borderRadius: 2,
              minWidth: 160,
              border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
              bgcolor: alpha(theme.palette.error.main, 0.04),
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 }
            }}
          >
            <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <ErrorIcon sx={{ color: 'error.main', fontSize: 28 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Rupture (0)</Typography>
                  <Typography variant="h4" fontWeight={800} color="error.main">{criticalCount}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
          <Card
            sx={{
              borderRadius: 2,
              minWidth: 160,
              border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
              bgcolor: alpha(theme.palette.warning.main, 0.06),
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 }
            }}
          >
            <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Warning sx={{ color: 'warning.main', fontSize: 28 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Sous seuil</Typography>
                  <Typography variant="h4" fontWeight={800} color="warning.dark">{warningCount}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
          <Button
            variant="outlined"
            startIcon={<ShoppingCart />}
            onClick={() => navigate('/app/stock/reorders')}
            sx={{ alignSelf: 'center', textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
          >
            Voir les demandes d&apos;approvisionnement
          </Button>
        </Box>
      )}

      {/* Liste des alertes */}
      <Card
        sx={{
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
          overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          transition: 'box-shadow 0.2s',
          '&:hover': { boxShadow: 2 }
        }}
      >
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={280} p={4}>
              <CircularProgress />
            </Box>
          ) : alerts.length === 0 ? (
            <Box
              sx={{
                py: 8,
                px: 2,
                textAlign: 'center',
                bgcolor: alpha(theme.palette.success.main, 0.04),
                borderRadius: 2,
                mx: 2,
                mb: 2
              }}
            >
              <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2, opacity: 0.9 }} />
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Aucune alerte
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 360, mx: 'auto' }}>
                Toutes les pièces sont au-dessus du seuil minimum.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<ArrowForward />}
                onClick={() => navigate('/app/stock')}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Voir le stock
              </Button>
            </Box>
          ) : (
            <Table size="medium">
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                  <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>Pièce</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }} align="right">Stock actuel</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }} align="right">Seuil min.</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>Niveau</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>Type</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: 'text.secondary' }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {alerts.map((alert, index) => {
                  const ratio = alert.minStock > 0 ? Math.min((alert.currentStock / alert.minStock) * 100, 100) : 0;
                  const isCritical = alert.currentStock === 0;
                  return (
                    <TableRow
                      key={alert.id}
                      sx={{
                        '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.04) },
                        transition: 'background 0.2s'
                      }}
                    >
                      <TableCell>
                        <Box>
                          <Typography fontWeight={600} variant="body2">
                            {alert.code && (
                              <Typography component="span" variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                                {alert.code}
                              </Typography>
                            )}
                            {alert.name}
                          </Typography>
                          {alert.unit && alert.unit !== 'unité' && (
                            <Typography variant="caption" color="text.secondary">{alert.unit}</Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          fontWeight={700}
                          color={isCritical ? 'error.main' : 'warning.dark'}
                          variant="body2"
                        >
                          {alert.currentStock}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary">
                          {alert.minStock}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={isCritical ? 0 : ratio}
                            sx={{
                              flex: 1,
                              height: 8,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.warning.main, 0.2),
                              '& .MuiLinearProgress-bar': {
                                bgcolor: isCritical ? 'error.main' : ratio < 50 ? 'warning.main' : 'success.main'
                              }
                            }}
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 28 }}>
                            {isCritical ? '0%' : `${Math.round(ratio)}%`}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={isCritical ? <ErrorIcon sx={{ fontSize: 16 }} /> : <Warning sx={{ fontSize: 16 }} />}
                          label={isCritical ? 'Rupture' : 'Sous seuil'}
                          size="small"
                          color={isCritical ? 'error' : 'warning'}
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ShoppingCart />}
                          onClick={() => navigate('/app/stock/reorders')}
                          sx={{ textTransform: 'none', fontWeight: 600 }}
                        >
                          Valider / Voir demande
                        </Button>
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
