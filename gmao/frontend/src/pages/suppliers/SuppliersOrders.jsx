import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  TextField,
  InputAdornment
} from '@mui/material';
import { Search, ShoppingCart, LocalShipping } from '@mui/icons-material';
import api from '../../services/api';
import { useCurrency } from '../../context/CurrencyContext';
import { useSnackbar } from '../../context/SnackbarContext';

const ORDER_STATUS_LABELS = { draft: 'Brouillon', sent: 'Envoyée', confirmed: 'Confirmée', received: 'Reçue', cancelled: 'Annulée' };

export default function SuppliersOrders() {
  const currency = useCurrency();
  const snackbar = useSnackbar();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [receivingId, setReceivingId] = useState(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const res = await api.get('/suppliers/orders');
      setOrders(res.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleReceive = async (orderId) => {
    setReceivingId(orderId);
    try {
      await api.post(`/suppliers/orders/${orderId}/receive`);
      loadOrders();
      snackbar.showSuccess('Commande réceptionnée. Le stock a été mis à jour.');
    } catch (e) {
      snackbar.showError(e.response?.data?.error || 'Erreur lors de la réception.');
    } finally {
      setReceivingId(null);
    }
  };

  const filteredOrders = orders.filter(o =>
    !search || (o.order_number || o.orderNumber || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.supplier_name || o.supplierName || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Commandes fournisseurs
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Créez la commande depuis une demande d&apos;achat (choix du fournisseur), puis réceptionnez pour mettre à jour le stock.
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <TextField
            size="small"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              )
            }}
          />
          <Typography variant="body2" color="text.secondary">Création dans le menu Création</Typography>
        </Box>
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : filteredOrders.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucune commande enregistrée
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Numéro</TableCell>
                  <TableCell>Fournisseur</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Montant</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell>Date réception</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{order.order_number || order.orderNumber}</TableCell>
                    <TableCell>{order.supplier_name || order.supplierName}</TableCell>
                    <TableCell>{new Date(order.order_date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>{order.total_amount?.toFixed(2) || '0.00'} {currency}</TableCell>
                    <TableCell>
                      <Chip
                        icon={order.status === 'received' ? <ShoppingCart /> : undefined}
                        label={ORDER_STATUS_LABELS[order.status] || order.status}
                        size="small"
                        color={order.status === 'received' ? 'success' : order.status === 'sent' || order.status === 'confirmed' ? 'warning' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{order.received_date ? new Date(order.received_date).toLocaleDateString('fr-FR') : '-'}</TableCell>
                    <TableCell align="right">
                      {order.status !== 'received' && order.status !== 'cancelled' && (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={receivingId === order.id ? <CircularProgress size={16} /> : <LocalShipping />}
                          onClick={() => handleReceive(order.id)}
                          disabled={!!receivingId}
                        >
                          Réceptionner
                        </Button>
                      )}
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
