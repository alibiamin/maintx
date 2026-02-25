import React, { useEffect, useState } from 'react';
import { Box, Card, Table, TableBody, TableCell, TableHead, TableRow, CircularProgress, Typography, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';

const STATUS_LABELS = { draft: 'Brouillon', received: 'Reçue', paid: 'Payée', cancelled: 'Annulée' };

export default function SupplierInvoicesList() {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const snackbar = useSnackbar();

  useEffect(() => {
    setLoading(true);
    api.get('/supplier-invoices').then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch(() => snackbar.showError('Erreur chargement')).finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>{t('item.suppliers_invoices', 'Factures fournisseur')}</Typography>
      <Card>
        {loading ? <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box> : (
          <Table size="small">
            <TableHead><TableRow><TableCell>N° facture</TableCell><TableCell>Fournisseur</TableCell><TableCell>Date</TableCell><TableCell>Montant</TableCell><TableCell>Statut</TableCell></TableRow></TableHead>
            <TableBody>
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center"><Typography color="text.secondary">Aucune facture.</Typography></TableCell></TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.invoiceNumber}</TableCell>
                    <TableCell>{row.supplierName || '—'}</TableCell>
                    <TableCell>{(row.invoiceDate || '').slice(0, 10)}</TableCell>
                    <TableCell>{Number(row.totalAmount).toFixed(2)} {row.currency || 'EUR'}</TableCell>
                    <TableCell><Chip size="small" color={row.status === 'paid' ? 'success' : 'default'} label={STATUS_LABELS[row.status] || row.status} /></TableCell>
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
