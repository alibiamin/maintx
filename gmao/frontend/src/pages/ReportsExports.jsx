import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  CircularProgress
} from '@mui/material';
import { Download, PictureAsPdf, TableChart } from '@mui/icons-material';
import api from '../services/api';

export default function ReportsExports() {
  const [loading, setLoading] = useState(null);

  const exportTypes = [
    { id: 'workorders', label: 'Ordres de travail', format: 'Excel', icon: <TableChart />, apiPath: '/reports/export/excel', filename: 'rapport-ot.xlsx' },
    { id: 'costs', label: 'Rapport détaillé (coûts, périodes)', format: 'Excel', icon: <TableChart />, apiPath: '/reports/export/detailed', filename: 'rapport-detaille.xlsx', withDates: true },
    { id: 'equipment', label: 'Liste des équipements', format: 'PDF', icon: <PictureAsPdf />, apiPath: '/reports/export/pdf/equipment', filename: 'liste-equipements.pdf' },
    { id: 'maintenance', label: 'Plans de maintenance', format: 'PDF', icon: <PictureAsPdf />, implemented: false },
    { id: 'stock', label: 'État des stocks', format: 'PDF', icon: <PictureAsPdf />, apiPath: '/reports/export/pdf/stock', filename: 'etat-stocks.pdf' },
    { id: 'kpis', label: 'Indicateurs de performance', format: 'PDF', icon: <PictureAsPdf />, apiPath: '/reports/export/pdf/kpis', filename: 'indicateurs-kpis.pdf', withDates: true }
  ];

  const handleExport = async (item) => {
    if (item.implemented === false) {
      return;
    }
    setLoading(item.id);
    try {
      const params = item.withDates ? { startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] } : {};
      const res = await api.get(item.apiPath, { responseType: 'blob', params });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Exports et rapports
      </Typography>
      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          <List>
            {exportTypes.map((exportType) => (
              <ListItem
                key={exportType.id}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  mb: 1
                }}
              >
                <Box sx={{ mr: 2, color: 'primary.main' }}>
                  {exportType.icon}
                </Box>
                <ListItemText
                  primary={exportType.label}
                  secondary={exportType.implemented === false ? 'Non disponible (à venir)' : `Format: ${exportType.format}${exportType.withDates ? ' (période par défaut 30 j)' : ''}`}
                />
                <ListItemSecondaryAction>
                  <Chip label={exportType.format} size="small" sx={{ mr: 1 }} />
                  <Button
                    variant="outlined"
                    startIcon={loading === exportType.id ? <CircularProgress size={16} /> : <Download />}
                    onClick={() => handleExport(exportType)}
                    disabled={exportType.implemented === false || loading !== null || !exportType.apiPath}
                  >
                    Exporter
                  </Button>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
    </Box>
  );
}
