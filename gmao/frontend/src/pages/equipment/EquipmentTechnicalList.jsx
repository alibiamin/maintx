import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  CircularProgress,
  TextField,
  InputAdornment,
  IconButton
} from '@mui/material';
import { Search, Visibility, Edit } from '@mui/icons-material';
import api from '../../services/api';

export default function EquipmentTechnicalList() {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadEquipment();
  }, []);

  const loadEquipment = async () => {
    try {
      const res = await api.get('/equipment');
      setEquipment(res.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEquipment = equipment.filter(eq =>
    !search || eq.name?.toLowerCase().includes(search.toLowerCase()) ||
    eq.code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Fiches techniques
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Consultation et modification des fiches techniques des équipements
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
          ) : filteredEquipment.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucun équipement trouvé
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Nom</TableCell>
                  <TableCell>Fabricant</TableCell>
                  <TableCell>Modèle</TableCell>
                  <TableCell>Numéro de série</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEquipment.map((eq) => (
                  <TableRow key={eq.id}>
                    <TableCell>{eq.code}</TableCell>
                    <TableCell>{eq.name}</TableCell>
                    <TableCell>{eq.manufacturer || '-'}</TableCell>
                    <TableCell>{eq.model || '-'}</TableCell>
                    <TableCell>{eq.serialNumber || '-'}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => navigate(`/app/equipment/${eq.id}/technical`)} title="Voir">
                        <Visibility />
                      </IconButton>
                      <IconButton size="small" onClick={() => navigate(`/app/equipment/${eq.id}/technical`)} title="Modifier la fiche technique">
                        <Edit />
                      </IconButton>
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
