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
  Button,
  CircularProgress,
  TextField,
  InputAdornment
} from '@mui/material';
import { Search, Factory } from '@mui/icons-material';
import api from '../services/api';

export default function SitesLines() {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadLines();
  }, []);

  const loadLines = async () => {
    try {
      const res = await api.get('/lignes');
      const data = (res.data || []).map((l) => ({
        ...l,
        siteName: l.site_name != null ? l.site_name : l.siteName
      }));
      setLines(data);
    } catch (error) {
      console.error(error);
      setLines([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredLines = lines.filter((l) =>
    !search ||
    l.name?.toLowerCase().includes(search.toLowerCase()) ||
    (l.siteName || l.site_name)?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Lignes de production
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestion des lignes de production par site
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
        </Box>
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : filteredLines.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucune ligne de production enregistrée
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nom</TableCell>
                  <TableCell>Site</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Équipements</TableCell>
                  <TableCell>Statut</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Factory />
                        {line.name}
                      </Box>
                    </TableCell>
                    <TableCell>{line.siteName}</TableCell>
                    <TableCell>{line.code || '-'}</TableCell>
                    <TableCell>
                      <Chip label={line.equipmentCount || 0} size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip label={line.status || 'Actif'} size="small" color={line.status === 'Actif' ? 'success' : 'default'} />
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
