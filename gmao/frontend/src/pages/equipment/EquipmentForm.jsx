import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Alert
} from '@mui/material';
import { ArrowBack, Save } from '@mui/icons-material';
import api from '../../services/api';

export default function EquipmentForm() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [lignes, setLignes] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    categoryId: '',
    ligneId: '',
    parentId: '',
    serialNumber: '',
    manufacturer: '',
    model: '',
    installationDate: '',
    location: '',
    criticite: 'B',
    status: 'operational'
  });

  useEffect(() => {
    Promise.all([
      api.get('/equipment/categories'),
      api.get('/lignes'),
      api.get('/equipment')
    ]).then(([cat, lig, eq]) => {
      setCategories(cat.data);
      setLignes(lig.data);
      setEquipment(eq.data);
    }).catch(console.error);
  }, []);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const payload = {
      code: form.code,
      name: form.name,
      description: form.description || undefined,
      categoryId: form.categoryId ? parseInt(form.categoryId) : undefined,
      ligneId: form.ligneId ? parseInt(form.ligneId) : undefined,
      parentId: form.parentId ? parseInt(form.parentId) : undefined,
      serialNumber: form.serialNumber || undefined,
      manufacturer: form.manufacturer || undefined,
      model: form.model || undefined,
      installationDate: form.installationDate || undefined,
      location: form.location || undefined,
      criticite: form.criticite,
      status: form.status
    };
    api.post('/equipment', payload)
      .then(r => navigate(`/equipment/${r.data.id}`))
      .catch(err => setError(err.response?.data?.error || 'Erreur lors de la création'))
      .finally(() => setLoading(false));
  };

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/equipment')} sx={{ mb: 2 }}>
        Retour
      </Button>
      <Card sx={{ maxWidth: 720, borderRadius: 2 }}>
        <CardContent>
          <Box component="form" onSubmit={handleSubmit}>
            <h3 style={{ margin: '0 0 16px' }}>Nouvel équipement</h3>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Code"
                  value={form.code}
                  onChange={(e) => handleChange('code', e.target.value)}
                  placeholder="Ex: EQ-001"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Nom"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth multiline rows={2} label="Description" value={form.description} onChange={(e) => handleChange('description', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Catégorie</InputLabel>
                  <Select value={form.categoryId} label="Catégorie" onChange={(e) => handleChange('categoryId', e.target.value)}>
                    <MenuItem value="">—</MenuItem>
                    {categories.map(c => (
                      <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Ligne</InputLabel>
                  <Select value={form.ligneId} label="Ligne" onChange={(e) => handleChange('ligneId', e.target.value)}>
                    <MenuItem value="">—</MenuItem>
                    {lignes.map(l => (
                      <MenuItem key={l.id} value={l.id}>{l.name} ({l.site_name})</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Équipement parent</InputLabel>
                  <Select value={form.parentId} label="Équipement parent" onChange={(e) => handleChange('parentId', e.target.value)}>
                    <MenuItem value="">—</MenuItem>
                    {equipment.map(eq => (
                      <MenuItem key={eq.id} value={eq.id}>{eq.code} — {eq.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="N° série" value={form.serialNumber} onChange={(e) => handleChange('serialNumber', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Constructeur" value={form.manufacturer} onChange={(e) => handleChange('manufacturer', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Modèle" value={form.model} onChange={(e) => handleChange('model', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth type="date" label="Date installation" value={form.installationDate} onChange={(e) => handleChange('installationDate', e.target.value)} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Localisation" value={form.location} onChange={(e) => handleChange('location', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Criticité</InputLabel>
                  <Select value={form.criticite} label="Criticité" onChange={(e) => handleChange('criticite', e.target.value)}>
                    <MenuItem value="A">A (Production)</MenuItem>
                    <MenuItem value="B">B (Support)</MenuItem>
                    <MenuItem value="C">C (Secondaire)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Statut</InputLabel>
                  <Select value={form.status} label="Statut" onChange={(e) => handleChange('status', e.target.value)}>
                    <MenuItem value="operational">Opérationnel</MenuItem>
                    <MenuItem value="maintenance">En maintenance</MenuItem>
                    <MenuItem value="out_of_service">Hors service</MenuItem>
                    <MenuItem value="retired">Retiré</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button type="submit" variant="contained" startIcon={<Save />} disabled={loading || !form.code || !form.name}>
                {loading ? 'Création...' : 'Créer'}
              </Button>
              <Button onClick={() => navigate('/equipment')}>Annuler</Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
