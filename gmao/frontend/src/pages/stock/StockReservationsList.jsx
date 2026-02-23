import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
  Typography
} from '@mui/material';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useCurrency } from '../../context/CurrencyContext';
import { useSnackbar } from '../../context/SnackbarContext';
import { useCurrency } from '../../context/CurrencyContext';

const STATUS_LABELS = { reserved: 'Réservé', consumed: 'Consommé', released: 'Libéré', cancelled: 'Annulé' };

export default function StockReservationsList() {
  const { t } = useTranslation();
  const snackbar = useSnackbar();
  const currency = useCurrency();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/stock-reservations')
      .then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch(() => snackbar.showError('Erreur chargement'))
      .finally(() => setLoading(false));
  }, [snackbar]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
        {t('item.stock_reservations')}
      </Typography>
      <Card>
        {loading ? (
          <Box p={4} display="flex" justifyContent="center">
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('stock.part')}</TableCell>
                  <TableCell>{t('stock.family')}</TableCell>
                  <TableCell>{t('stock.location')}</TableCell>
                  <TableCell>OT</TableCell>
                  <TableCell align="right">{t('stock.quantity')}</TableCell>
                  <TableCell align="right">{t('stock.unitPrice')}</TableCell>
                  <TableCell align="right">{t('stock.lineCost')}</TableCell>
                  <TableCell>{t('stock.status')}</TableCell>
                  <TableCell>{t('stock.reservedBy')}</TableCell>
                  <TableCell>{t('stock.date')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      <Typography color="text.secondary">
                        {t('stock.noReservations')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>
                        {row.spare_part_id != null ? (
                          <Link
                            to={`/app/stock/parts/${row.spare_part_id}`}
                            style={{ color: 'inherit', fontWeight: 500 }}
                          >
                            {row.part_code} - {row.part_name}
                          </Link>
                        ) : (
                          `${row.part_code || ''} - ${row.part_name || ''}`
                        )}
                      </TableCell>
                      <TableCell>{row.part_family_name || row.part_family_code || '—'}</TableCell>
                      <TableCell>{row.location_name || row.location_code || '—'}</TableCell>
                      <TableCell>
                        {row.work_order_id != null ? (
                          <Link
                            to={`/app/work-orders/${row.work_order_id}`}
                            style={{ color: 'inherit', fontWeight: 500 }}
                          >
                            {row.wo_number} - {row.wo_title}
                          </Link>
                        ) : (
                          `${row.wo_number || ''} - ${row.wo_title || ''}`
                        )}
                      </TableCell>
                      <TableCell align="right">{row.quantity}</TableCell>
                      <TableCell align="right">{row.unit_price != null ? `${Number(row.unit_price).toFixed(2)} ${currency}` : '—'}</TableCell>
                      <TableCell align="right">{row.line_cost != null ? `${Number(row.line_cost).toFixed(2)} ${currency}` : '—'}</TableCell>
                      <TableCell>{STATUS_LABELS[row.status] || row.status}</TableCell>
                      <TableCell>{row.reserved_by_name || '—'}</TableCell>
                      <TableCell>{row.reserved_at || '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {list.length > 0 && list.some((r) => r.line_cost != null) && (
              <Typography variant="body2" fontWeight={600} sx={{ p: 2 }}>
                {t('stock.totalCost')} : {currency} {list.reduce((sum, r) => sum + (Number(r.line_cost) || 0), 0).toFixed(2)}
              </Typography>
            )}
          </>
        )}
      </Card>
    </Box>
  );
}
