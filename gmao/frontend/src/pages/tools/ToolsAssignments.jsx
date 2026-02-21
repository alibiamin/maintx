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
  CircularProgress,
  TextField,
  InputAdornment
} from '@mui/material';
import { Search, Person } from '@mui/icons-material';
import api from '../../services/api';

export default function ToolsAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    try {
      const res = await api.get('/tools/assignments');
      setAssignments(res.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAssignments = assignments.filter(a =>
    !search || a.toolName?.toLowerCase().includes(search.toLowerCase()) ||
    a.userName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Assignations d'outils
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Répartition des outils aux techniciens
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
          ) : filteredAssignments.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucune assignation enregistrée
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Outil</TableCell>
                  <TableCell>Technicien</TableCell>
                  <TableCell>Date assignation</TableCell>
                  <TableCell>Date retour prévue</TableCell>
                  <TableCell>Statut</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAssignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>{assignment.toolName}</TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Person />
                        {assignment.userName}
                      </Box>
                    </TableCell>
                    <TableCell>{new Date(assignment.assigned_date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>{assignment.expected_return_date ? new Date(assignment.expected_return_date).toLocaleDateString('fr-FR') : '-'}</TableCell>
                    <TableCell>
                      <Chip label={assignment.status} size="small" color={assignment.status === 'returned' ? 'success' : 'default'} />
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
