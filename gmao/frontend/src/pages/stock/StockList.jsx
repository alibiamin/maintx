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
  TablePagination,
  Chip,
  TextField,
  InputAdornment,
  Button,
  CircularProgress,
  FormControl,
  Select,
  MenuItem,
  IconButton
} from '@mui/material';
import { Search, Warning, Visibility } from '@mui/icons-material';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useTranslation } from 'react-i18next';

export default function StockList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currency = useCurrency();
  const [parts, setParts] = useState([]);
  const [total, setTotal] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAlerts, setShowAlerts] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortBy, setSortBy] = useState('code');
  const [sortOrder, setSortOrder] = useState('asc');
  const { user } = useAuth();
  const canEdit = ['administrateur', 'responsable_maintenance'].includes(user?.role);

  useEffect(() => {
    const fetch = () => {
      setLoading(true);
      const params = { page: page + 1, limit: rowsPerPage, sortBy, order: sortOrder };
      if (search) params.search = search;
      if (showAlerts) params.belowMin = 'true';
      api.get('/stock/parts', { params })
        .then(r => {
          const res = r.data;
          setParts(Array.isArray(res) ? res : (res?.data ?? []));
          setTotal(res?.total ?? (res?.data?.length ?? res?.length ?? 0));
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    };
    fetch();
  }, [search, showAlerts, page, rowsPerPage, sortBy, sortOrder]);

  const handleChangePage = (_, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); };

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
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <Select value={`${sortBy}-${sortOrder}`} displayEmpty onChange={(e) => {
              const [s, o] = e.target.value.split('-');
              setSortBy(s);
              setSortOrder(o);
              setPage(0);
            }}>
              <MenuItem value="code-asc">Code (A-Z)</MenuItem>
              <MenuItem value="code-desc">Code (Z-A)</MenuItem>
              <MenuItem value="name-asc">Désignation (A-Z)</MenuItem>
              <MenuItem value="name-desc">Désignation (Z-A)</MenuItem>
            </Select>
          </FormControl>
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
                <TableCell>{t('stock.family')}</TableCell>
                <TableCell>{t('stock.location')}</TableCell>
                <TableCell>Fournisseur</TableCell>
                <TableCell align="right">Stock</TableCell>
                {(parts[0] && (parts[0].quantity_accepted != null || parts[0].quantity_quarantine != null)) && (
                  <>
                    <TableCell align="right">A</TableCell>
                    <TableCell align="right">Q</TableCell>
                    <TableCell align="right">R</TableCell>
                  </>
                )}
                <TableCell align="right">Seuil min</TableCell>
                <TableCell align="right">{t('stock.unitPrice')}</TableCell>
                <TableCell>Alerte</TableCell>
                <TableCell width={56}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {parts.map((p) => (
                <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/app/stock/parts/${p.id}`)}>
                  <TableCell>{p.code}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.part_family_name || p.part_family_code || '-'}</TableCell>
                  <TableCell>{p.location_name || p.location_code || '-'}</TableCell>
                  <TableCell>{p.supplier_name || '-'}</TableCell>
                  <TableCell align="right">{p.stock_quantity ?? 0}</TableCell>
                  {(parts[0] && (parts[0].quantity_accepted != null || parts[0].quantity_quarantine != null)) && (
                    <>
                      <TableCell align="right"><Chip size="small" label={p.quantity_accepted ?? 0} color="success" variant="outlined" title="Accepté" /></TableCell>
                      <TableCell align="right"><Chip size="small" label={p.quantity_quarantine ?? 0} color="warning" variant="outlined" title="Quarantaine" /></TableCell>
                      <TableCell align="right"><Chip size="small" label={p.quantity_rejected ?? 0} color="error" variant="outlined" title="Rejeté" /></TableCell>
                    </>
                  )}
                  <TableCell align="right">{p.min_stock}</TableCell>
                  <TableCell align="right">{p.unit_price != null ? `${Number(p.unit_price).toFixed(2)} ${currency}` : '-'}</TableCell>
                  <TableCell>
                    {(p.stock_quantity ?? 0) <= p.min_stock ? (
                      <Chip label="Stock bas" size="small" color="warning" />
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell padding="none" onClick={(e) => e.stopPropagation()}>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigate(`/app/stock/parts/${p.id}`); }} title="Voir la fiche">
                      <Visibility />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && parts.length === 0 && (
          <Box p={4} textAlign="center" color="text.secondary">Aucune piece trouvee</Box>
        )}
        {!loading && total > 0 && (
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 20, 50]}
            labelRowsPerPage="Lignes par page"
          />
        )}
      </Card>
    </Box>
  );
}
