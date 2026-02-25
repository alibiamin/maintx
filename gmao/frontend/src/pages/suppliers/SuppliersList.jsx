import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  Button,
  CircularProgress,
  Typography
} from '@mui/material';
import { Search } from '@mui/icons-material';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function SuppliersList() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { can } = useAuth();
  const canEdit = can('suppliers', 'update');

  useEffect(() => {
    setLoading(true);
    const params = search ? { search } : {};
    api.get('/suppliers', { params }).then(r => setSuppliers(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [search]);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <h2 style={{ margin: 0 }}>Fournisseurs</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>Gestion des fournisseurs et commandes</p>
        </Box>
        {canEdit && (
          <Typography variant="body2" color="text.secondary" component="span">Création dans le menu Création</Typography>
        )}
      </Box>

      <Card sx={{ mb: 2, p: 2 }}>
        <TextField
          placeholder="Rechercher..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
          sx={{ minWidth: 250 }}
        />
      </Card>

      <Card>
        {loading ? (
          <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Nom</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Telephone</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.code}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.contact_person || '-'}</TableCell>
                  <TableCell>{s.email || '-'}</TableCell>
                  <TableCell>{s.phone || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && suppliers.length === 0 && (
          <Box p={4} textAlign="center" color="text.secondary">Aucun fournisseur</Box>
        )}
      </Card>
    </Box>
  );
}
