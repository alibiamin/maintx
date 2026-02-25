import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Typography
} from '@mui/material';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const isAdmin = user?.isAdmin === true;

  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const roleLabels = {
    administrateur: 'Administrateur',
    responsable_maintenance: 'Responsable maintenance',
    technicien: 'Technicien',
    utilisateur: 'Utilisateur'
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <h2 style={{ margin: 0 }}>Utilisateurs</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>Gestion des comptes et rôles</p>
        </Box>
        {isAdmin && (
          <Typography variant="body2" color="text.secondary">Création dans le menu Création</Typography>
        )}
      </Box>

      <Card>
        {loading ? (
          <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nom</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Rôle</TableCell>
                <TableCell>Statut</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>{u.first_name} {u.last_name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell><Chip label={roleLabels[u.role_name] || u.role_name} size="small" /></TableCell>
                  <TableCell><Chip label={u.is_active ? 'Actif' : 'Inactif'} size="small" color={u.is_active ? 'success' : 'default'} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

    </Box>
  );
}
