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
  Chip,
  CircularProgress
} from '@mui/material';
import { Warning, Error } from '@mui/icons-material';
import api from '../../services/api';

export default function StockAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const res = await api.get('/stock/alerts');
      setAlerts(res.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Alertes de stock
      </Typography>
      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : alerts.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucune alerte
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Pièce</TableCell>
                  <TableCell>Stock actuel</TableCell>
                  <TableCell>Stock minimum</TableCell>
                  <TableCell>Type d'alerte</TableCell>
                  <TableCell>Priorité</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell>{alert.partName}</TableCell>
                    <TableCell>
                      <Typography fontWeight={600} color={alert.currentStock < alert.minStock ? 'error' : 'text.primary'}>
                        {alert.currentStock}
                      </Typography>
                    </TableCell>
                    <TableCell>{alert.minStock}</TableCell>
                    <TableCell>
                      <Chip
                        icon={alert.alertType === 'critical' ? <Error /> : <Warning />}
                        label={alert.alertType}
                        size="small"
                        color={alert.alertType === 'critical' ? 'error' : 'warning'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip label={alert.priority} size="small" color={alert.priority === 'Haute' ? 'error' : 'default'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
