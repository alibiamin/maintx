import React, { useEffect, useState } from 'react';
import { Box, Card, Table, TableBody, TableCell, TableHead, TableRow, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';

export default function ReorderRulesList() {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const snackbar = useSnackbar();

  useEffect(() => {
    setLoading(true);
    api.get('/reorder-rules').then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch(() => snackbar.showError('Erreur chargement')).finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>{t('item.stock_reorder_rules', 'Règles de réapprovisionnement')}</Typography>
      <Card>
        {loading ? <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box> : (
          <Table size="small">
            <TableHead><TableRow><TableCell>Pièce</TableCell><TableCell>Magasin / Site</TableCell><TableCell>Seuil min</TableCell><TableCell>Seuil max</TableCell><TableCell>Délai (j)</TableCell><TableCell>Commande auto</TableCell></TableRow></TableHead>
            <TableBody>
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center"><Typography color="text.secondary">Aucune règle de réapprovisionnement.</Typography></TableCell></TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.partCode} – {row.partName || '—'}</TableCell>
                    <TableCell>{row.warehouseName || row.siteName || '—'}</TableCell>
                    <TableCell>{row.minQuantity}</TableCell>
                    <TableCell>{row.maxQuantity}</TableCell>
                    <TableCell>{row.leadTimeDays ?? 0}</TableCell>
                    <TableCell>{row.autoCreatePo ? 'Oui' : 'Non'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </Box>
  );
}
