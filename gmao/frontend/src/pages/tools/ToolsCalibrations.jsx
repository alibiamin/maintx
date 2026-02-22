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
import { Search, Warning } from '@mui/icons-material';
import api from '../../services/api';

export default function ToolsCalibrations() {
  const [calibrations, setCalibrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadCalibrations();
  }, []);

  const loadCalibrations = async () => {
    try {
      const res = await api.get('/tools/calibrations');
      setCalibrations(res.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCalibrations = calibrations.filter(c =>
    !search || c.toolName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Calibrations d'outils
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Suivi des calibrations et certifications
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
          ) : filteredCalibrations.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucune calibration enregistrée
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Outil</TableCell>
                  <TableCell>Date calibration</TableCell>
                  <TableCell>Date d'échéance</TableCell>
                  <TableCell>Statut</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCalibrations.map((cal) => {
                  const dueDate = cal.calibration_due_date;
                  const isExpiring = dueDate && new Date(dueDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                  const isExpired = dueDate && new Date(dueDate) < new Date();
                  return (
                    <TableRow key={cal.id}>
                      <TableCell>{cal.toolName || cal.name || cal.code || '-'}</TableCell>
                      <TableCell>{(cal.calibration_date && new Date(cal.calibration_date).toLocaleDateString('fr-FR')) || '-'}</TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          {(dueDate && new Date(dueDate).toLocaleDateString('fr-FR')) || '-'}
                          {isExpiring && !isExpired && <Warning color="warning" fontSize="small" />}
                          {isExpired && <Warning color="error" fontSize="small" />}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={cal.is_valid && !isExpired ? 'Valide' : 'Expirée'}
                          size="small"
                          color={cal.is_valid && !isExpired ? 'success' : 'error'}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
