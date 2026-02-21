import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  CircularProgress,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Divider
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import api from '../../services/api';

const statusColors = { operational: 'success', maintenance: 'warning', out_of_service: 'error', retired: 'default' };

export default function EquipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id === 'new') {
      navigate('/creation', { replace: true });
      return;
    }
    const numId = id != null && /^\d+$/.test(String(id)) ? id : null;
    if (!numId) {
      setLoading(false);
      navigate('/equipment');
      return;
    }
    Promise.all([
      api.get(`/equipment/${numId}`),
      api.get(`/equipment/${numId}/history`)
    ]).then(([eq, hist]) => {
      setEquipment(eq.data);
      setHistory(Array.isArray(hist.data) ? hist.data : []);
    }).catch(() => navigate('/equipment')).finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading || !equipment) return <Box p={4}><CircularProgress /></Box>;

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/equipment')} sx={{ mb: 2 }}>Retour</Button>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
            <Box>
              <Typography variant="h5">{equipment.name}</Typography>
              <Typography color="text.secondary">{equipment.code}</Typography>
              <Chip label={equipment.status} color={statusColors[equipment.status]} size="small" sx={{ mt: 1 }} />
            </Box>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">Catégorie</Typography>
              <Typography>{equipment.categoryName || '-'}</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">N° série</Typography>
              <Typography>{equipment.serialNumber || '-'}</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">Constructeur / Modèle</Typography>
              <Typography>{[equipment.manufacturer, equipment.model].filter(Boolean).join(' - ') || '-'}</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">Localisation</Typography>
              <Typography>{equipment.location || '-'}</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">Date d'installation</Typography>
              <Typography>{equipment.installationDate || '-'}</Typography>
            </Grid>
            {equipment.description && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                <Typography>{equipment.description}</Typography>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Historique des interventions</Typography>
          {history.length === 0 ? (
            <Typography color="text.secondary">Aucune intervention enregistrée</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>N° OT</TableCell>
                  <TableCell>Titre</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell>Technicien</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((wo) => (
                  <TableRow key={wo.id}>
                    <TableCell><Button size="small" onClick={() => navigate(`/work-orders/${wo.id}`)}>{wo.number}</Button></TableCell>
                    <TableCell>{wo.title}</TableCell>
                    <TableCell>{wo.type_name}</TableCell>
                    <TableCell><Chip label={wo.status} size="small" /></TableCell>
                    <TableCell>{wo.assigned_name || '-'}</TableCell>
                    <TableCell>{new Date(wo.created_at).toLocaleDateString('fr-FR')}</TableCell>
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
