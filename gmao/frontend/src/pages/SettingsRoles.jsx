import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
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
  CircularProgress
} from '@mui/material';
import api from '../services/api';
import { useActionPanel } from '../context/ActionPanelContext';

export default function SettingsRoles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const { setContext } = useActionPanel();
  const location = useLocation();

  useEffect(() => {
    loadRoles();
  }, []);

  useEffect(() => {
    setContext({ type: 'list', entityType: 'roles' });
    return () => setContext(null);
  }, [setContext]);

  useEffect(() => {
    const fromState = location.state?.selectedRoleId;
    if (fromState != null && roles.some((r) => r.id === fromState)) {
      setSelectedId(fromState);
    }
  }, [location.state?.selectedRoleId, roles]);

  useEffect(() => {
    if (!selectedId) return;
    const role = roles.find((r) => r.id === selectedId);
    setContext(role ? { type: 'list', entityType: 'roles', selectedEntity: role } : { type: 'list', entityType: 'roles' });
  }, [selectedId, roles, setContext]);

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
                </TableRow>
              </TableHead>
              <TableBody>
                {roles.map((role) => (
                  <TableRow
                    key={role.id}
                    selected={selectedId === role.id}
                    onClick={() => setSelectedId(selectedId === role.id ? null : role.id)}
                    sx={{ cursor: 'pointer' }}
                  >
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
