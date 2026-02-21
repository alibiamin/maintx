import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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

export default function WorkOrderForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [equipment, setEquipment] = useState([]);
  const [types, setTypes] = useState([]);
  const [maintenancePlans, setMaintenancePlans] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    equipmentId: '',
    typeId: 2,
    priority: 'medium',
    assignedTo: '',
    plannedStart: '',
    plannedEnd: '',
    maintenancePlanId: ''
  });

  useEffect(() => {
    Promise.all([
      api.get('/equipment'),
      api.get('/work-orders/types'),
      api.get('/maintenance-plans'),
      api.get('/users/assignable').catch(() => ({ data: [] }))
    ]).then(([eq, ty, plans, us]) => {
      setEquipment(eq.data || []);
      setTypes(ty.data || []);
      setMaintenancePlans(plans.data || []);
      setUsers(us.data || []);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    const s = location.state;
    if (s?.maintenancePlanId || s?.equipmentId || s?.title) {
      setForm(prev => ({
        ...prev,
        ...(s.title && { title: s.title }),
        ...(s.equipmentId && { equipmentId: String(s.equipmentId) }),
        ...(s.maintenancePlanId && { maintenancePlanId: String(s.maintenancePlanId) })
      }));
    }
  }, [location.state]);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const payload = {
      title: form.title,
      description: form.description || undefined,
      equipmentId: form.equipmentId ? parseInt(form.equipmentId) : undefined,
      typeId: form.typeId ? parseInt(form.typeId) : 2,
      priority: form.priority,
      assignedTo: form.assignedTo ? parseInt(form.assignedTo) : undefined,
      plannedStart: form.plannedStart || undefined,
      plannedEnd: form.plannedEnd || undefined,
      maintenancePlanId: form.maintenancePlanId ? parseInt(form.maintenancePlanId, 10) : undefined
    };
    api.post('/work-orders', payload)
      .then(r => navigate(`/work-orders/${r.data.id}`))
      .catch(err => setError(err.response?.data?.error || 'Erreur'))
      .finally(() => setLoading(false));
  };

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/work-orders')} sx={{ mb: 2 }}>Retour</Button>
      <Card sx={{ maxWidth: 640, borderRadius: 2 }}>
        <CardContent>
          <Box component="form" onSubmit={handleSubmit}>
            <h3 style={{ margin: '0 0 16px' }}>Declarer une panne / Creer un OT</h3>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField fullWidth required label="Titre" value={form.title} onChange={(e) => handleChange('title', e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth multiline rows={2} label="Description" value={form.description} onChange={(e) => handleChange('description', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Equipement</InputLabel>
                  <Select value={form.equipmentId} label="Equipement" onChange={(e) => handleChange('equipmentId', e.target.value)}>
                    <MenuItem value="">—</MenuItem>
                    {equipment.map(eq => <MenuItem key={eq.id} value={eq.id}>{eq.code} — {eq.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select value={form.typeId} label="Type" onChange={(e) => handleChange('typeId', e.target.value)}>
                    {types.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Plan de maintenance</InputLabel>
                  <Select value={form.maintenancePlanId || ''} label="Plan de maintenance" onChange={(e) => handleChange('maintenancePlanId', e.target.value)}>
                    <MenuItem value="">—</MenuItem>
                    {maintenancePlans.map(p => <MenuItem key={p.id} value={p.id}>{p.name} ({p.equipment_code})</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Priorite</InputLabel>
                  <Select value={form.priority} label="Priorite" onChange={(e) => handleChange('priority', e.target.value)}>
                    <MenuItem value="low">Basse</MenuItem>
                    <MenuItem value="medium">Moyenne</MenuItem>
                    <MenuItem value="high">Haute</MenuItem>
                    <MenuItem value="critical">Critique</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Technicien</InputLabel>
                  <Select value={form.assignedTo} label="Technicien" onChange={(e) => handleChange('assignedTo', e.target.value)}>
                    <MenuItem value="">Non assigne</MenuItem>
                    {users.map(u => <MenuItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth type="datetime-local" label="Debut prevu" value={form.plannedStart} onChange={(e) => handleChange('plannedStart', e.target.value)} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth type="datetime-local" label="Fin prevue" value={form.plannedEnd} onChange={(e) => handleChange('plannedEnd', e.target.value)} InputLabelProps={{ shrink: true }} />
              </Grid>
            </Grid>
            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button type="submit" variant="contained" startIcon={<Save />} disabled={loading || !form.title}>Creer</Button>
              <Button onClick={() => navigate('/work-orders')}>Annuler</Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
