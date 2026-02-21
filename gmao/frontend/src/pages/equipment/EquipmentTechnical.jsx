import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  CircularProgress,
  Divider
} from '@mui/material';
import { Save, Edit } from '@mui/icons-material';
import api from '../../services/api';

export default function EquipmentTechnical() {
  const { id } = useParams();
  const [equipment, setEquipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadEquipment();
  }, [id]);

  const loadEquipment = async () => {
    try {
      const res = await api.get(`/equipment/${id}`);
      setEquipment(res.data);
      setFormData(res.data.technicalSpecs || {});
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await api.put(`/equipment/${id}`, { technicalSpecs: formData });
      setEditing(false);
      loadEquipment();
    } catch (error) {
      console.error(error);
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
            Fiche technique
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {equipment?.code} - {equipment?.name}
          </Typography>
        </Box>
        {!editing ? (
          <Button variant="contained" startIcon={<Edit />} onClick={() => setEditing(true)}>
            Modifier
          </Button>
        ) : (
          <Box display="flex" gap={1}>
            <Button variant="outlined" onClick={() => setEditing(false)}>
              Annuler
            </Button>
            <Button variant="contained" startIcon={<Save />} onClick={handleSave}>
              Enregistrer
            </Button>
          </Box>
        )}
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Fabricant"
                value={equipment?.manufacturer || ''}
                disabled={!editing}
                variant={editing ? 'outlined' : 'filled'}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Modèle"
                value={equipment?.model || ''}
                disabled={!editing}
                variant={editing ? 'outlined' : 'filled'}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Numéro de série"
                value={equipment?.serialNumber || ''}
                disabled={!editing}
                variant={editing ? 'outlined' : 'filled'}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Date d'installation"
                type="date"
                value={equipment?.installationDate || ''}
                disabled={!editing}
                variant={editing ? 'outlined' : 'filled'}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Spécifications techniques
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Puissance"
                value={formData.power || ''}
                onChange={(e) => setFormData({ ...formData, power: e.target.value })}
                disabled={!editing}
                variant={editing ? 'outlined' : 'filled'}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Tension"
                value={formData.voltage || ''}
                onChange={(e) => setFormData({ ...formData, voltage: e.target.value })}
                disabled={!editing}
                variant={editing ? 'outlined' : 'filled'}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Notes techniques"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                disabled={!editing}
                variant={editing ? 'outlined' : 'filled'}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
