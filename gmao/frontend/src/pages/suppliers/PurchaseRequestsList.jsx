import React, { useEffect, useState } from 'react';
import { Box, Card, Table, TableBody, TableCell, TableHead, TableRow, CircularProgress, Typography, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';

const STATUS_LABELS = { draft: 'Brouillon', submitted: 'Soumis', approved: 'Approuvé', rejected: 'Rejeté', ordered: 'Commandé', cancelled: 'Annulé' };

export default function PurchaseRequestsList() {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const snackbar = useSnackbar();

  useEffect(() => {
    setLoading(true);
    api.get('/purchase-requests').then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch(() => snackbar.showError('Erreur chargement')).finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>{t('item.suppliers_purchase_requests', 'Demandes d\'achat')}</Typography>
      <Card>
        {loading ? <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box> : (
          <Table size="small">
            <TableHead><TableRow><TableCell>N°</TableCell><TableCell>Titre</TableCell><TableCell>Date</TableCell><TableCell>Statut</TableCell><TableCell>Lignes</TableCell></TableRow></TableHead>
            <TableBody>
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center"><Typography color="text.secondary">Aucune demande d&apos;achat.</Typography></TableCell></TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.prNumber}</TableCell>
                    <TableCell>{row.title}</TableCell>
                    <TableCell>{(row.requestDate || '').slice(0, 10)}</TableCell>
                    <TableCell><Chip size="small" label={STATUS_LABELS[row.status] || row.status} /></TableCell>
                    <TableCell>{(row.lines || []).length}</TableCell>
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
