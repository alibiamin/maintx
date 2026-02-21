import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import { Search, ArrowUpward, ArrowDownward, SwapHoriz } from '@mui/icons-material';
import api from '../../services/api';

export default function StockMovements() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    loadMovements();
  }, []);

  const loadMovements = async () => {
    try {
      const res = await api.get('/stock/movements');
      setMovements(res.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'entry':
        return <ArrowUpward color="success" />;
      case 'exit':
        return <ArrowDownward color="error" />;
      case 'transfer':
        return <SwapHoriz color="info" />;
      default:
        return null;
    }
  };

  const filteredMovements = movements.filter(m =>
    (!search || m.partName?.toLowerCase().includes(search.toLowerCase())) &&
    (typeFilter === 'all' || m.movement_type === typeFilter)
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Mouvements de stock
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Historique des entrées, sorties et transferts
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Type</InputLabel>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} label="Type">
              <MenuItem value="all">Tous</MenuItem>
              <MenuItem value="entry">Entrées</MenuItem>
              <MenuItem value="exit">Sorties</MenuItem>
              <MenuItem value="transfer">Transferts</MenuItem>
            </Select>
          </FormControl>
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
        </Box>
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : filteredMovements.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucun mouvement enregistré
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Pièce</TableCell>
                  <TableCell>Quantité</TableCell>
                  <TableCell>Référence</TableCell>
                  <TableCell>Utilisateur</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredMovements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>{new Date(movement.created_at).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        {getIcon(movement.movement_type)}
                        <Chip label={movement.movement_type} size="small" />
                      </Box>
                    </TableCell>
                    <TableCell>{movement.partName}</TableCell>
                    <TableCell>{movement.quantity}</TableCell>
                    <TableCell>{movement.reference || '-'}</TableCell>
                    <TableCell>{movement.userName || '-'}</TableCell>
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
