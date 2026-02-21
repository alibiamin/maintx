import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
  InputAdornment
} from '@mui/material';
import { Search, Build, Assignment } from '@mui/icons-material';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

export default function EquipmentHistory() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadHistory();
  }, [id]);

  const loadHistory = async () => {
    try {
      const res = await api.get(`/equipment/${id}/history`);
      setHistory(res.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter(h =>
    !search || h.description?.toLowerCase().includes(search.toLowerCase()) ||
    h.workOrderNumber?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Historique des interventions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Toutes les interventions sur cet équipement
          </Typography>
        </Box>
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

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : filteredHistory.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucun historique disponible
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Ordre de travail</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Technicien</TableCell>
                  <TableCell>Durée</TableCell>
                  <TableCell>Statut</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{new Date(item.date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>
                      <Chip icon={item.type === 'maintenance' ? <Build /> : <Assignment />} label={item.type} size="small" />
                    </TableCell>
                    <TableCell>{item.workOrderNumber || '-'}</TableCell>
                    <TableCell>{item.description || '-'}</TableCell>
                    <TableCell>{item.technicianName || '-'}</TableCell>
                    <TableCell>{item.duration || '-'}</TableCell>
                    <TableCell>
                      <Chip label={t(`status.${item.status}`, item.status)} size="small" color={item.status === 'completed' ? 'success' : 'default'} />
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
