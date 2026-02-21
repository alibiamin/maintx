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
  IconButton,
  CircularProgress,
  Chip
} from '@mui/material';
import { Edit, Delete, MoreVert } from '@mui/icons-material';
import api from '../../services/api';
import { useActionPanelHelpers } from '../../hooks/useActionPanel';

export default function EquipmentCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { openEntityPanel, openListPanel } = useActionPanelHelpers();

  useEffect(() => {
    loadCategories();
  }, []);

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
        <Box display="flex" gap={1}>
          <Button variant="outlined" onClick={() => openListPanel('equipment')}>
            Actions
          </Button>
          <Typography variant="body2" color="text.secondary">Création dans le menu Création</Typography>
        </Box>
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
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell>{cat.name}</TableCell>
                    <TableCell>{cat.description || '-'}</TableCell>
                    <TableCell>{cat.parentName || '-'}</TableCell>
                    <TableCell>
                      <Chip label={cat.equipmentCount || 0} size="small" />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEntityPanel('equipment', cat)}>
                        <MoreVert fontSize="small" />
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
