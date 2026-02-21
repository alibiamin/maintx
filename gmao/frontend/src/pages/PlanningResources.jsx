import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import { Person, Build, Assignment } from '@mui/icons-material';
import api from '../services/api';

export default function PlanningResources() {
  const [resources, setResources] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    try {
      const res = await api.get('/planning/resources');
      setResources(res.data);
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
      <Typography variant="h5" fontWeight={700} mb={3}>
        Ressources disponibles
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Person color="primary" />
                <Typography variant="h6" fontWeight={600}>
                  Techniciens
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight={700} color="primary">
                {resources?.technicians?.total || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                {resources?.technicians?.available || 0} disponibles
              </Typography>
              <List dense>
                {(resources?.technicians?.list || []).slice(0, 5).map((tech) => (
                  <ListItem key={tech.id}>
                    <ListItemText
                      primary={tech.name}
                      secondary={
                        <Chip label={tech.status} size="small" color={tech.status === 'available' ? 'success' : 'default'} />
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Build color="warning" />
                <Typography variant="h6" fontWeight={600}>
                  Équipements
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight={700} color="warning.main">
                {resources?.equipment?.total || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                {resources?.equipment?.operational || 0} opérationnels
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Assignment color="success" />
                <Typography variant="h6" fontWeight={600}>
                  Ordres de travail
                </Typography>
              </Box>
              <Typography variant="h3" fontWeight={700} color="success.main">
                {resources?.workOrders?.total || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                {resources?.workOrders?.pending || 0} en attente
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
