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
import api from '../services/api';

export default function PlanningAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    try {
      const res = await api.get('/planning/assignments');
      setAssignments(res.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAssignments = assignments.filter(a =>
    !search || a.technicianName?.toLowerCase().includes(search.toLowerCase()) ||
    a.workOrderTitle?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Affectations des techniciens
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Répartition des interventions par technicien
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
              Aucune affectation enregistrée
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Technicien</TableCell>
                  <TableCell>Ordre de travail</TableCell>
                  <TableCell>Équipement</TableCell>
                  <TableCell>Date prévue</TableCell>
                  <TableCell>Durée estimée</TableCell>
                  <TableCell>Statut</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAssignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Person />
                        {assignment.technicianName}
                      </Box>
                    </TableCell>
                    <TableCell>{assignment.workOrderTitle}</TableCell>
                    <TableCell>{assignment.equipmentName}</TableCell>
                    <TableCell>{new Date(assignment.scheduled_date).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>{assignment.estimated_duration || '-'}</TableCell>
                    <TableCell>
                      <Chip label={assignment.status} size="small" color={assignment.status === 'completed' ? 'success' : 'default'} />
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
