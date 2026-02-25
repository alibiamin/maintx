import React, { useEffect, useState } from 'react';
import { Box, Card, Table, TableBody, TableCell, TableHead, TableRow, CircularProgress, Typography, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';

const STATUS_LABELS = { draft: 'Brouillon', sent: 'Envoyé', received: 'Reçu', closed: 'Clôturé', cancelled: 'Annulé' };

export default function PriceRequestsList() {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const snackbar = useSnackbar();

  useEffect(() => {
    setLoading(true);
    api.get('/price-requests').then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch(() => snackbar.showError('Erreur chargement')).finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>{t('item.suppliers_price_requests', 'Demandes de prix (RFQ)')}</Typography>
      <Card>
        {loading ? <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box> : (
          <Table size="small">
            <TableHead><TableRow><TableCell>N°</TableCell><TableCell>Titre</TableCell><TableCell>Fournisseur</TableCell><TableCell>Statut</TableCell><TableCell>Date envoi</TableCell></TableRow></TableHead>
            <TableBody>
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center"><Typography color="text.secondary">Aucune demande de prix.</Typography></TableCell></TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.rfqNumber}</TableCell>
                    <TableCell>{row.title}</TableCell>
                    <TableCell>{row.supplierName || '—'}</TableCell>
                    <TableCell><Chip size="small" label={STATUS_LABELS[row.status] || row.status} /></TableCell>
                    <TableCell>{(row.sentDate || '').slice(0, 10) || '—'}</TableCell>
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
