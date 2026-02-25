import React, { useEffect, useState } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableHead, TableRow,
  Button, CircularProgress, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem, Tabs, Tab, Chip, Link
} from '@mui/material';
import { Add, Science, Build, MenuBook } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useSnackbar } from '../context/SnackbarContext';
import { useAuth } from '../context/AuthContext';

const PROCEDURE_TYPES = [
  { value: 'maintenance', label: 'Maintenance', icon: <Build fontSize="small" /> },
  { value: 'test', label: 'Mode opératoire de test', icon: <Science fontSize="small" /> },
  { value: 'operating_mode', label: 'Mode opératoire', icon: <MenuBook fontSize="small" /> }
];

export default function ProceduresList() {
  const [list, setList] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', steps: '', safetyNotes: '', equipmentModelId: '', procedureType: 'maintenance', code: '' });
  const [saving, setSaving] = useState(false);
  const [usageDialog, setUsageDialog] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const { user, can } = useAuth();
  const snackbar = useSnackbar();
  const navigate = useNavigate();
  const canEdit = can('procedures', 'update');

  const load = () => {
    setLoading(true);
    const params = filterType ? { procedureType: filterType } : {};
    Promise.all([api.get('/procedures', { params }), api.get('/equipment-models').catch(() => ({ data: [] }))])
      .then(([r1, r2]) => {
        setList(Array.isArray(r1.data) ? r1.data : []);
        setModels(Array.isArray(r2.data) ? r2.data : []);
      })
      .catch(() => snackbar.showError('Erreur chargement'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterType]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', description: '', steps: '', safetyNotes: '', equipmentModelId: '', procedureType: filterType || 'maintenance', code: '' });
    setDialogOpen(true);
  };

  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({
      name: p.name || '',
      description: p.description || '',
      steps: p.steps || '',
      safetyNotes: p.safetyNotes || '',
      equipmentModelId: p.equipmentModelId ?? '',
      procedureType: p.procedureType || 'maintenance',
      code: p.code ?? ''
    });
    setDialogOpen(true);
  };

  const showUsage = (p) => {
    setUsageDialog({ procedure: p });
    setUsageLoading(true);
    api.get(`/procedures/${p.id}/usage`)
      .then((r) => setUsageDialog((prev) => ({ ...prev, ...r.data })))
      .catch(() => snackbar.showError('Erreur chargement des liaisons'))
      .finally(() => setUsageLoading(false));
  };

  const handleSave = () => {
    if (!form.name.trim()) { snackbar.showError('Nom requis'); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description || null,
      steps: form.steps || null,
      safetyNotes: form.safetyNotes || null,
      equipmentModelId: form.equipmentModelId || null,
      procedureType: form.procedureType || 'maintenance',
      code: form.code?.trim() || null
    };
    if (editingId) {
      api.put(`/procedures/${editingId}`, payload)
        .then(() => { snackbar.showSuccess('Procédure mise à jour'); setDialogOpen(false); load(); })
        .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
        .finally(() => setSaving(false));
    } else {
      api.post('/procedures', payload)
        .then(() => { snackbar.showSuccess('Procédure créée'); setDialogOpen(false); load(); })
        .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
        .finally(() => setSaving(false));
    }
  };

  const handleDelete = (id) => {
    if (!window.confirm('Supprimer cette procédure ? Les liaisons avec les plans et OT seront supprimées.')) return;
    api.delete(`/procedures/${id}`)
      .then(() => { snackbar.showSuccess('Procédure supprimée'); load(); setUsageDialog(null); })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'));
  };

  const typeLabel = (t) => PROCEDURE_TYPES.find((x) => x.value === t)?.label || t || 'Maintenance';

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Procédures et modes opératoires</Typography>
          <Typography variant="body2" color="text.secondary">
            Procédures de maintenance, modes opératoires de test et modes opératoires — liés aux plans de maintenance, aux OT et aux modèles d'équipement.
          </Typography>
        </Box>
        {canEdit && (
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Nouvelle procédure</Button>
        )}
      </Box>

      <Tabs value={filterType} onChange={(_, v) => setFilterType(v || '')} sx={{ mb: 2 }}>
        <Tab label="Toutes" value="" />
        {PROCEDURE_TYPES.map((t) => (
          <Tab key={t.value} label={t.label} value={t.value} icon={t.icon} iconPosition="start" />
        ))}
      </Tabs>

      <Card>
        {loading ? (
          <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Nom</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Modèle d'équipement</TableCell>
                <TableCell>Liaisons</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary">
                      {filterType ? 'Aucune procédure de ce type.' : 'Aucune procédure. Créez-en une (maintenance, mode opératoire de test ou mode opératoire) pour lier des étapes et consignes aux plans et OT.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                list.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.code || '—'}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>
                      <Chip size="small" label={typeLabel(p.procedureType)} variant="outlined" />
                    </TableCell>
                    <TableCell>{p.equipmentModelName || '—'}</TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => showUsage(p)}>Voir liaisons</Button>
                    </TableCell>
                    <TableCell align="right">
                      {canEdit && (
                        <>
                          <Button size="small" onClick={() => openEdit(p)}>Modifier</Button>
                          <Button size="small" color="error" onClick={() => handleDelete(p.id)}>Supprimer</Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Modifier la procédure' : 'Nouvelle procédure'}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>Type</InputLabel>
            <Select value={form.procedureType} label="Type" onChange={(e) => setForm((f) => ({ ...f, procedureType: e.target.value }))}>
              {PROCEDURE_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField fullWidth label="Code (référence)" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} margin="normal" placeholder="ex. TEST-001" />
          <TextField fullWidth label="Nom" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required margin="normal" />
          <TextField fullWidth label="Description" multiline rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} margin="normal" />
          <TextField fullWidth label="Étapes (texte libre)" multiline rows={4} value={form.steps} onChange={(e) => setForm((f) => ({ ...f, steps: e.target.value }))} margin="normal" placeholder="1. ... 2. ..." />
          <TextField fullWidth label="Consignes de sécurité" multiline rows={2} value={form.safetyNotes} onChange={(e) => setForm((f) => ({ ...f, safetyNotes: e.target.value }))} margin="normal" />
          <FormControl fullWidth margin="normal">
            <InputLabel>Modèle d'équipement</InputLabel>
            <Select value={form.equipmentModelId} label="Modèle d'équipement" onChange={(e) => setForm((f) => ({ ...f, equipmentModelId: e.target.value }))}>
              <MenuItem value="">Aucun</MenuItem>
              {models.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{editingId ? 'Enregistrer' : 'Créer'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(usageDialog)} onClose={() => setUsageDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Liaisons — {usageDialog?.procedure?.name}</DialogTitle>
        <DialogContent>
          {usageLoading ? (
            <Box display="flex" justifyContent="center" py={3}><CircularProgress /></Box>
          ) : (
            <Box>
              <Typography variant="subtitle2" color="primary" gutterBottom>Plans de maintenance</Typography>
              {usageDialog?.maintenancePlans?.length ? (
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {usageDialog.maintenancePlans.map((mp) => (
                    <li key={mp.id}>
                      <Link component="button" variant="body2" onClick={() => { navigate(`/app/maintenance-plans`); setUsageDialog(null); }}>{mp.name}</Link>
                      {mp.equipment_name && ` — ${mp.equipment_code || ''} ${mp.equipment_name}`}
                    </li>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">Aucun plan lié</Typography>
              )}
              <Typography variant="subtitle2" color="primary" sx={{ mt: 2 }} gutterBottom>Ordres de travail</Typography>
              {usageDialog?.workOrders?.length ? (
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {usageDialog.workOrders.map((wo) => (
                    <li key={wo.id}>
                      <Link component="button" variant="body2" onClick={() => { navigate(`/app/work-orders/${wo.id}`); setUsageDialog(null); }}>{wo.number} — {wo.title}</Link>
                      {wo.status && ` (${wo.status})`}
                    </li>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">Aucun OT lié</Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUsageDialog(null)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
