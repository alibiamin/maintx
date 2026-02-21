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
  Button,
  Chip,
  CircularProgress,
  IconButton
} from '@mui/material';
import { Edit, Delete, MoreVert } from '@mui/icons-material';
import api from '../services/api';
import { useActionPanelHelpers } from '../hooks/useActionPanel';

export default function SettingsRoles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const { openEntityPanel } = useActionPanelHelpers();

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const res = await api.get('/settings/roles');
      setRoles(res.data || []);
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
            Rôles et permissions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestion des rôles utilisateurs et leurs permissions
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">Création dans le menu Création</Typography>
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : roles.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucun rôle enregistré
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nom</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Utilisateurs</TableCell>
                  <TableCell>Permissions</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <Typography fontWeight={600}>{role.name}</Typography>
                    </TableCell>
                    <TableCell>{role.description || '-'}</TableCell>
                    <TableCell>
                      <Chip label={role.userCount || 0} size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip label={`${role.permissionCount || 0} permissions`} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEntityPanel('roles', role)}>
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
