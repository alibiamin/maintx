import React, { useEffect, useState } from 'react';
import { Box, Card, Table, TableBody, TableCell, TableHead, TableRow, CircularProgress, Typography, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';

const STATUS_LABELS = { ok: 'Conforme', overdue: 'En retard', pending: 'À faire', cancelled: 'Annulé' };
const CHECK_TYPE_LABELS = { periodic: 'Périodique', legal: 'Réglementaire', safety: 'Sécurité', quality: 'Qualité' };

export default function RegulatoryChecksList() {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const snackbar = useSnackbar();

  useEffect(() => {
    setLoading(true);
    api.get('/regulatory-checks').then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch(() => snackbar.showError('Erreur chargement')).finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>{t('item.regulatory_checks', 'Contrôles réglementaires')}</Typography>
      <Card>
        {loading ? <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box> : (
          <Table size="small">
            <TableHead><TableRow><TableCell>Code</TableCell><TableCell>Nom</TableCell><TableCell>Entité</TableCell><TableCell>Type</TableCell><TableCell>Échéance</TableCell><TableCell>Statut</TableCell></TableRow></TableHead>
            <TableBody>
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center"><Typography color="text.secondary">Aucun contrôle réglementaire.</Typography></TableCell></TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.entityName || `#${row.entityId}`}</TableCell>
                    <TableCell>{CHECK_TYPE_LABELS[row.checkType] || row.checkType}</TableCell>
                    <TableCell>{(row.nextDueDate || '').slice(0, 10)}</TableCell>
                    <TableCell><Chip size="small" color={row.status === 'overdue' ? 'error' : row.status === 'ok' ? 'success' : 'default'} label={STATUS_LABELS[row.status] || row.status} /></TableCell>
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
