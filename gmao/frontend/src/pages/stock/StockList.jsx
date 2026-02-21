import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  TextField,
  InputAdornment,
  Button,
  CircularProgress
} from '@mui/material';
import { Search, Warning } from '@mui/icons-material';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function StockList() {
  const [parts, setParts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAlerts, setShowAlerts] = useState(false);
  const { user } = useAuth();
  const canEdit = ['administrateur', 'responsable_maintenance'].includes(user?.role);

  useEffect(() => {
    const fetch = () => {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (showAlerts) params.belowMin = 'true';
      api.get('/stock/parts', { params })
        .then(r => setParts(r.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    };
    fetch();
  }, [search, showAlerts]);

  useEffect(() => {
    api.get('/stock/alerts').then(r => setAlerts(r.data)).catch(console.error);
  }, []);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <h2 style={{ margin: 0 }}>Stocks</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>Pieces de rechange et alertes</p>
        </Box>
        {alerts.length > 0 && (
          <Chip icon={<Warning />} label={alerts.length + ' alerte(s) stock bas'} color="warning" onClick={() => setShowAlerts(true)} />
        )}
      </Box>

      <Card sx={{ mb: 2, p: 2 }}>
        <Box display="flex" gap={2} flexWrap="wrap">
          <TextField
            placeholder="Rechercher..."
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
            sx={{ minWidth: 200 }}
          />
          <Button variant={showAlerts ? 'contained' : 'outlined'} size="small" onClick={() => setShowAlerts(!showAlerts)}>
            Stock minimum
          </Button>
        </Box>
      </Card>

      <Card>
        {loading ? (
          <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Designation</TableCell>
                <TableCell>Fournisseur</TableCell>
                <TableCell align="right">Stock</TableCell>
                <TableCell align="right">Seuil min</TableCell>
                <TableCell align="right">Prix unit.</TableCell>
                <TableCell>Alerte</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {parts.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>{p.code}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.supplier_name || '-'}</TableCell>
                  <TableCell align="right">{p.stock_quantity ?? 0}</TableCell>
                  <TableCell align="right">{p.min_stock}</TableCell>
                  <TableCell align="right">{p.unit_price ? p.unit_price.toFixed(2) + ' EUR' : '-'}</TableCell>
                  <TableCell>
                    {(p.stock_quantity ?? 0) <= p.min_stock ? (
                      <Chip label="Stock bas" size="small" color="warning" />
                    ) : (
                      '-'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && parts.length === 0 && (
          <Box p={4} textAlign="center" color="text.secondary">Aucune piece trouvee</Box>
        )}
      </Card>
    </Box>
  );
}
