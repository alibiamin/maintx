import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
  Typography,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ShoppingCart } from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';

const STATUS_LABELS = { draft: 'Brouillon', submitted: 'Soumis', approved: 'Approuvé', rejected: 'Rejeté', ordered: 'Commandé', cancelled: 'Annulé' };

export default function PurchaseRequestsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertPrId, setConvertPrId] = useState(null);
  const [supplierId, setSupplierId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadList = () => {
    setLoading(true);
    api.get('/purchase-requests').then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch(() => snackbar.showError('Erreur chargement')).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    if (convertOpen) {
      api.get('/suppliers').then((r) => setSuppliers(r.data || [])).catch(() => setSuppliers([]));
    }
  }, [convertOpen]);

  const openConvert = (row) => {
    setConvertPrId(row.id);
    setSupplierId(row.lines?.[0] ? '' : '');
    setConvertOpen(true);
  };

  const handleConvert = async () => {
    if (!convertPrId || !supplierId) return;
    setSubmitting(true);
    try {
      await api.post(`/purchase-requests/${convertPrId}/convert-to-order`, { supplierId: parseInt(supplierId, 10) });
      setConvertOpen(false);
      setConvertPrId(null);
      setSupplierId('');
      loadList();
      snackbar.showSuccess('Commande fournisseur créée. Vous pouvez la réceptionner dans Commandes.');
      navigate('/app/suppliers/orders');
    } catch (e) {
      snackbar.showError(e.response?.data?.error || 'Erreur lors de la création de la commande.');
    } finally {
      setSubmitting(false);
    }
  };

  const canConvert = (row) =>
    (row.status === 'draft' || row.status === 'approved' || row.status === 'submitted') && !row.supplierOrderId && (row.lines || []).length > 0;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>{t('item.suppliers_purchase_requests', 'Demandes d\'achat')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Validez les demandes issues des alertes stock, puis choisissez un fournisseur pour créer la commande et réceptionner.
      </Typography>
      <Card>
        {loading ? <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box> : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>N°</TableCell>
                <TableCell>Titre</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Lignes</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center"><Typography color="text.secondary">Aucune demande d&apos;achat.</Typography></TableCell></TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.prNumber}</TableCell>
                    <TableCell>{row.title}</TableCell>
                    <TableCell>{(row.requestDate || '').slice(0, 10)}</TableCell>
                    <TableCell><Chip size="small" label={STATUS_LABELS[row.status] || row.status} color={row.status === 'ordered' ? 'success' : 'default'} /></TableCell>
                    <TableCell>{(row.lines || []).length}</TableCell>
                    <TableCell align="right">
                      {canConvert(row) && (
                        <Button size="small" variant="outlined" startIcon={<ShoppingCart />} onClick={() => openConvert(row)}>
                          Créer commande
                        </Button>
                      )}
                      {row.status === 'ordered' && (
                        <Button size="small" onClick={() => navigate('/app/suppliers/orders')}>Voir commandes</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={convertOpen} onClose={() => setConvertOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Choisir le fournisseur</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Fournisseur</InputLabel>
            <Select value={supplierId} label="Fournisseur" onChange={(e) => setSupplierId(e.target.value)}>
              <MenuItem value="">—</MenuItem>
              {suppliers.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.code ? `${s.code} — ` : ''}{s.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConvertOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleConvert} disabled={!supplierId || submitting}>
            {submitting ? <CircularProgress size={24} /> : 'Créer la commande'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
