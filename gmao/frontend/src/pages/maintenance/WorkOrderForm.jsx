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
  FormControlLabel,
  InputLabel,
  Select,
  Grid,
  Alert,
  Typography,
  IconButton,
  Checkbox
} from '@mui/material';
import { ArrowBack, Save, Add, Delete } from '@mui/icons-material';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

export default function WorkOrderForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [equipment, setEquipment] = useState([]);
  const [types, setTypes] = useState([]);
  const [maintenancePlans, setMaintenancePlans] = useState([]);
  const [maintenanceProjects, setMaintenanceProjects] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [users, setUsers] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [spareParts, setSpareParts] = useState([]);
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    equipmentId: '',
    typeId: 2,
    priority: 'medium',
    assignedTo: '',
    assignedUserIds: [],
    plannedStart: '',
    plannedEnd: '',
    maintenancePlanId: '',
    procedureIds: [],
    projectId: '',
    checklistIds: [],
    reservations: [{ sparePartId: '', quantity: 1, notes: '' }],
    toolIds: [],
    createAsDraft: false
  });

  useEffect(() => {
    Promise.all([
      api.get('/equipment'),
      api.get('/work-orders/types'),
      api.get('/maintenance-plans'),
      api.get('/maintenance-projects').catch(() => ({ data: [] })),
      api.get('/procedures').catch(() => ({ data: [] })),
      api.get('/users/assignable').catch(() => ({ data: [] })),
      api.get('/checklists').catch(() => ({ data: [] })),
      api.get('/stock/parts').catch(() => ({ data: [] })),
      api.get('/tools').catch(() => ({ data: [] }))
    ]).then(([eq, ty, plans, projects, procRes, us, chkRes, partsRes, toolsRes]) => {
      setEquipment(eq.data || []);
      setTypes(ty.data || []);
      setMaintenancePlans(Array.isArray(plans.data) ? plans.data : []);
      setMaintenanceProjects(Array.isArray(projects?.data) ? projects.data : []);
      setProcedures(Array.isArray(procRes?.data) ? procRes.data : []);
      setUsers(us.data || []);
      const chk = chkRes?.data ?? [];
      setChecklists(Array.isArray(chk) ? chk : (chk?.data ? chk.data : []));
      const parts = partsRes?.data?.data ?? partsRes?.data ?? [];
      setSpareParts(Array.isArray(parts) ? parts : []);
      setTools(Array.isArray(toolsRes?.data) ? toolsRes.data : []);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    const s = location.state;
    if (s?.maintenancePlanId || s?.equipmentId || s?.title) {
      setForm(prev => {
        const next = { ...prev, ...(s.title && { title: s.title }), ...(s.equipmentId && { equipmentId: String(s.equipmentId) }), ...(s.maintenancePlanId && { maintenancePlanId: String(s.maintenancePlanId) }) };
        return next;
      });
    }
  }, [location.state]);

  useEffect(() => {
    const planId = form.maintenancePlanId && maintenancePlans.length ? maintenancePlans.find(p => String(p.id) === String(form.maintenancePlanId)) : null;
    if (planId?.procedure_id && (!form.procedureIds || form.procedureIds.length === 0)) setForm(prev => ({ ...prev, procedureIds: [String(planId.procedure_id)] }));
  }, [form.maintenancePlanId, maintenancePlans]);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const addReservationRow = () => setForm(prev => ({ ...prev, reservations: [...prev.reservations, { sparePartId: '', quantity: 1, notes: '' }] }));
  const removeReservationRow = (index) => setForm(prev => ({
    ...prev,
    reservations: prev.reservations.filter((_, i) => i !== index)
  }));
  const updateReservation = (index, key, value) => setForm(prev => ({
    ...prev,
    reservations: prev.reservations.map((r, i) => i === index ? { ...r, [key]: value } : r)
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const reservationsPayload = (form.reservations || [])
      .filter(r => r.sparePartId && Number(r.quantity) > 0)
      .map(r => ({ sparePartId: parseInt(r.sparePartId, 10), quantity: parseInt(r.quantity, 10) || 1, notes: r.notes || undefined }));
    const payload = {
      title: form.title,
      description: form.description || undefined,
      equipmentId: form.equipmentId ? parseInt(form.equipmentId) : undefined,
      typeId: form.typeId ? parseInt(form.typeId) : 2,
      priority: form.priority,
      assignedTo: (form.assignedUserIds && form.assignedUserIds[0]) ? parseInt(form.assignedUserIds[0], 10) : (form.assignedTo ? parseInt(form.assignedTo) : undefined),
      assignedUserIds: (form.assignedUserIds && form.assignedUserIds.length) ? form.assignedUserIds.map(id => parseInt(id, 10)) : undefined,
      projectId: form.projectId ? parseInt(form.projectId) : undefined,
      plannedStart: form.plannedStart || undefined,
      plannedEnd: form.plannedEnd || undefined,
      maintenancePlanId: form.maintenancePlanId ? parseInt(form.maintenancePlanId, 10) : undefined,
      procedureIds: (form.procedureIds && form.procedureIds.length) ? form.procedureIds.map(id => parseInt(id, 10)) : undefined,
      reservations: reservationsPayload.length ? reservationsPayload : undefined,
      toolIds: (form.toolIds && form.toolIds.length) ? form.toolIds.map(id => parseInt(id, 10)) : undefined,
      checklistIds: (form.checklistIds && form.checklistIds.length) ? form.checklistIds.map(id => parseInt(id, 10)) : undefined,
      statusWorkflow: form.createAsDraft ? 'draft' : undefined
    };
    api.post('/work-orders', payload)
      .then(r => navigate(`/app/work-orders/${r.data.id}`))
      .catch(err => setError(err.response?.data?.error || 'Erreur'))
      .finally(() => setLoading(false));
  };

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/app/work-orders')} sx={{ mb: 2 }}>Retour</Button>
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
                  <Select
                    value={form.maintenancePlanId || ''}
                    label="Plan de maintenance"
                    onChange={(e) => {
                      const planId = e.target.value;
                      handleChange('maintenancePlanId', planId);
                      if (planId) {
                        const plan = maintenancePlans.find(p => String(p.id) === String(planId));
                        if (plan?.procedure_id) handleChange('procedureId', String(plan.procedure_id));
                      }
                    }}
                  >
                    <MenuItem value="">—</MenuItem>
                    {maintenancePlans.map(p => <MenuItem key={p.id} value={p.id}>{p.name} ({p.equipment_code})</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Procédures / modes opératoires</InputLabel>
                  <Select
                    multiple
                    value={form.procedureIds || []}
                    onChange={(e) => handleChange('procedureIds', e.target.value)}
                    label="Procédures / modes opératoires"
                    renderValue={(sel) => (sel || []).map(id => procedures.find(p => p.id === id)?.name).filter(Boolean).join(', ') || '—'}
                  >
                    <MenuItem value="">—</MenuItem>
                    {procedures.map(pr => <MenuItem key={pr.id} value={pr.id}>{pr.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Projet de maintenance</InputLabel>
                  <Select value={form.projectId || ''} label="Projet de maintenance" onChange={(e) => handleChange('projectId', e.target.value)}>
                    <MenuItem value="">—</MenuItem>
                    {maintenanceProjects.filter(p => p.status === 'active' || p.status === 'draft').map(p => (
                      <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Priorite</InputLabel>
                  <Select value={form.priority} label="Priorite" onChange={(e) => handleChange('priority', e.target.value)}>
                    <MenuItem value="low">{t('priority.low')}</MenuItem>
                    <MenuItem value="medium">{t('priority.medium')}</MenuItem>
                    <MenuItem value="high">{t('priority.high')}</MenuItem>
                    <MenuItem value="critical">{t('priority.critical')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Opérateurs / Équipe</InputLabel>
                  <Select
                    multiple
                    value={form.assignedUserIds || []}
                    onChange={(e) => handleChange('assignedUserIds', e.target.value)}
                    label="Opérateurs / Équipe"
                    renderValue={(sel) => (sel || []).map(id => users.find(u => u.id === id) && `${users.find(u => u.id === id).first_name} ${users.find(u => u.id === id).last_name}`).filter(Boolean).join(', ') || '—'}
                  >
                    <MenuItem value="">—</MenuItem>
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

              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1, mb: 0.5 }}>Checklists à exécuter</Typography>
                <FormControl fullWidth size="small">
                  <InputLabel>Checklists</InputLabel>
                  <Select
                    multiple
                    value={form.checklistIds || []}
                    onChange={(e) => handleChange('checklistIds', e.target.value)}
                    label="Checklists"
                    renderValue={(sel) => (sel || []).map(id => checklists.find(c => c.id === id)?.name).filter(Boolean).join(', ') || '—'}
                  >
                    <MenuItem value="">—</MenuItem>
                    {checklists.map(c => (
                      <MenuItem key={c.id} value={c.id}>{c.name} {c.equipment_code ? `(${c.equipment_code})` : ''}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1, mb: 0.5 }}>Pièces détachées (réservations)</Typography>
                {(form.reservations || []).map((r, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>Pièce</InputLabel>
                      <Select
                        value={r.sparePartId || ''}
                        label="Pièce"
                        onChange={(e) => updateReservation(index, 'sparePartId', e.target.value)}
                      >
                        <MenuItem value="">—</MenuItem>
                        {spareParts.map(p => (
                          <MenuItem key={p.id} value={p.id}>{p.code || p.name} — {p.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      type="number"
                      size="small"
                      label="Qté"
                      value={r.quantity ?? 1}
                      onChange={(e) => updateReservation(index, 'quantity', e.target.value)}
                      inputProps={{ min: 1 }}
                      sx={{ width: 80 }}
                    />
                    <TextField
                      size="small"
                      label="Notes"
                      value={r.notes || ''}
                      onChange={(e) => updateReservation(index, 'notes', e.target.value)}
                      sx={{ flex: 1 }}
                    />
                    <IconButton size="small" onClick={() => removeReservationRow(index)} color="error" title="Supprimer la ligne"><Delete /></IconButton>
                  </Box>
                ))}
                <Button size="small" startIcon={<Add />} onClick={addReservationRow}>Ajouter une pièce</Button>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1, mb: 0.5 }}>Outils à affecter</Typography>
                <FormControl fullWidth size="small">
                  <InputLabel>Outils</InputLabel>
                  <Select
                    multiple
                    value={form.toolIds || []}
                    onChange={(e) => handleChange('toolIds', e.target.value)}
                    label="Outils"
                    renderValue={(sel) => (sel || []).map(id => tools.find(t => t.id === id)?.name).filter(Boolean).join(', ') || '—'}
                  >
                    <MenuItem value="">—</MenuItem>
                    {tools.map(t => (
                      <MenuItem key={t.id} value={t.id}>{t.code} — {t.name} {t.status !== 'available' ? `(${t.status})` : ''}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!!form.createAsDraft}
                      onChange={(e) => setForm((f) => ({ ...f, createAsDraft: e.target.checked }))}
                    />
                  }
                  label={t('workOrder.createAsDraft', 'Créer en brouillon (à planifier plus tard)')}
                />
              </Grid>
            </Grid>
            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button type="submit" variant="contained" startIcon={<Save />} disabled={loading || !form.title}>Creer</Button>
              <Button onClick={() => navigate('/app/work-orders')}>Annuler</Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
