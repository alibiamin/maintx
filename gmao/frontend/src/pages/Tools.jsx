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
  Chip,
  IconButton,
  CircularProgress
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import api from '../services/api';

export default function Tools() {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    try {
      const res = await api.get('/tools');
      setTools(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Outils et matériels
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestion du parc d'outils de maintenance
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />}>
          Nouvel outil
        </Button>
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {tools.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucun outil enregistré
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Nom</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Fabricant</TableCell>
                  <TableCell>Modèle</TableCell>
                  <TableCell>Localisation</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tools.map((tool) => (
                  <TableRow key={tool.id}>
                    <TableCell>{tool.code}</TableCell>
                    <TableCell>{tool.name}</TableCell>
                    <TableCell>{tool.tool_type || '-'}</TableCell>
                    <TableCell>{tool.manufacturer || '-'}</TableCell>
                    <TableCell>{tool.model || '-'}</TableCell>
                    <TableCell>{tool.location || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={tool.status === 'available' ? 'Disponible' : tool.status === 'in_use' ? 'En usage' : tool.status}
                        color={tool.status === 'available' ? 'success' : tool.status === 'in_use' ? 'warning' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small">
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small">
                        <Delete fontSize="small" />
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
