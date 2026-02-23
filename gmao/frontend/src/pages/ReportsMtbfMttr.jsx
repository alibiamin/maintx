import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableHead, TableRow, TextField, Button, CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useSnackbar } from '../context/SnackbarContext';

export default function ReportsMtbfMttr() {
  const { t } = useTranslation();
  const [mttr, setMttr] = useState(null);
  const [mtbf, setMtbf] = useState(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const snackbar = useSnackbar();

  const load = () => {
    setLoading(true);
    const params = { startDate, endDate };
    Promise.all([
      api.get('/reports/mttr', { params }).then((r) => setMttr(r.data)).catch(() => snackbar.showError('Erreur MTTR')),
      api.get('/reports/mtbf', { params }).then((r) => setMtbf(r.data)).catch(() => snackbar.showError('Erreur MTBF'))
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>{t('item.reports_mtbf_mttr')}</Typography>
      <Card sx={{ mb: 2, p: 2 }}>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <TextField type="date" label="Début" value={startDate} onChange={(e) => setStartDate(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
          <TextField type="date" label="Fin" value={endDate} onChange={(e) => setEndDate(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={load} disabled={loading}>{loading ? 'Chargement…' : 'Actualiser'}</Button>
        </Box>
      </Card>
      {loading ? <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box> : (
        <>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>MTTR (temps moyen de réparation, en heures)</Typography>
              <Typography color="text.secondary">Global : {mttr?.global?.mttr_hours != null ? `${Number(mttr.global.mttr_hours).toFixed(2)} h` : '—'} ({mttr?.global?.repair_count ?? 0} réparations)</Typography>
              <Table size="small" sx={{ mt: 2 }}>
                <TableHead><TableRow><TableCell>Équipement</TableCell><TableCell>Code</TableCell><TableCell>Réparations</TableCell><TableCell>MTTR (h)</TableCell></TableRow></TableHead>
                <TableBody>
                  {(mttr?.byEquipment || []).slice(0, 20).map((row) => (
                    <TableRow key={row.equipment_id}>
                      <TableCell>{row.name}</TableCell><TableCell>{row.code}</TableCell><TableCell>{row.repair_count}</TableCell><TableCell>{row.mttr_hours != null ? Number(row.mttr_hours).toFixed(2) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>MTBF (temps moyen entre pannes, en heures)</Typography>
              <Typography color="text.secondary">Global : {mtbf?.global?.mtbf_hours != null ? `${Number(mtbf.global.mtbf_hours).toFixed(2)} h` : '—'} ({mtbf?.global?.intervals ?? 0} intervalles)</Typography>
              <Table size="small" sx={{ mt: 2 }}>
                <TableHead><TableRow><TableCell>Équipement</TableCell><TableCell>Code</TableCell><TableCell>Intervalles</TableCell><TableCell>MTBF (h)</TableCell></TableRow></TableHead>
                <TableBody>
                  {(mtbf?.byEquipment || []).slice(0, 20).map((row) => (
                    <TableRow key={row.equipment_id}>
                      <TableCell>{row.name}</TableCell><TableCell>{row.code}</TableCell><TableCell>{row.intervals}</TableCell><TableCell>{row.mtbf_hours != null ? Number(row.mtbf_hours).toFixed(2) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}
