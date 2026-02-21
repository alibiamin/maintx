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
  CircularProgress,
  Chip
} from '@mui/material';
import api from '../../services/api';
import { useActionPanel } from '../../context/ActionPanelContext';

export default function EquipmentCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const { setContext } = useActionPanel();

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    setContext({ type: 'list', entityType: 'equipment' });
    return () => setContext(null);
  }, [setContext]);

  useEffect(() => {
    if (!selectedId) return;
    const cat = categories.find((c) => c.id === selectedId);
    setContext(cat ? { type: 'list', entityType: 'equipment', selectedEntity: cat } : { type: 'list', entityType: 'equipment' });
  }, [selectedId, categories, setContext]);

  const loadCategories = async () => {
    try {
      const res = await api.get('/equipment/categories');
      setCategories(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Catégories d'équipements
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestion des catégories et sous-catégories
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">Actions dans la barre à droite</Typography>
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : categories.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucune catégorie enregistrée
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nom</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Catégorie parente</TableCell>
                  <TableCell>Équipements</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow
                    key={cat.id}
                    selected={selectedId === cat.id}
                    onClick={() => setSelectedId(selectedId === cat.id ? null : cat.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{cat.name}</TableCell>
                    <TableCell>{cat.description || '-'}</TableCell>
                    <TableCell>{cat.parentName || '-'}</TableCell>
                    <TableCell>
                      <Chip label={cat.equipmentCount || 0} size="small" />
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
