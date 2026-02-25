import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton
} from '@mui/material';
import { ArrowBack, Add, Delete } from '@mui/icons-material';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSnackbar } from '../../context/SnackbarContext';

export default function TypeCompetenciesPage() {
  const navigate = useNavigate();
  const [links, setLinks] = useState([]);
  const [types, setTypes] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTypeId, setNewTypeId] = useState('');
  const [newCompId, setNewCompId] = useState('');
  const [newLevel, setNewLevel] = useState(3);
  const [saving, setSaving] = useState(false);
  const { user, can } = useAuth();
  const snackbar = useSnackbar();
  const canEdit = can('competencies', 'update');

  const load = () => {
    Promise.all([
      api.get('/technicians/type-competencies/list').then(r => r.data).catch(() => []),
      api.get('/work-orders/types').then(r => r.data).catch(() => []),
      api.get('/competencies').then(r => r.data).catch(() => [])
    ]).then(([l, t, c]) => {
      setLinks(l);
      setTypes(t);
      setCompetencies(c);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = () => {
    if (!newTypeId || !newCompId) { snackbar.showError('Choisissez un type et une compétence'); return; }
    const exists = links.some(l => l.work_order_type_id === parseInt(newTypeId, 10) && l.competence_id === parseInt(newCompId, 10));
    if (exists) { snackbar.showError('Cette liaison existe déjà'); return; }
    setSaving(true);
    const next = [...links, { work_order_type_id: parseInt(newTypeId, 10), competence_id: parseInt(newCompId, 10), required_level: newLevel }];
    api.put('/technicians/type-competencies/save', { links: next })
      .then(r => { setLinks(r.data); setNewTypeId(''); setNewCompId(''); setNewLevel(3); snackbar.showSuccess('Liaison ajoutée'); })
      .catch(() => snackbar.showError('Erreur'))
      .finally(() => setSaving(false));
  };

  const handleRemove = (typeId, compId) => {
    const next = links.filter(l => !(l.work_order_type_id === typeId && l.competence_id === compId));
    setSaving(true);
    api.put('/technicians/type-competencies/save', { links: next })
      .then(r => setLinks(r.data))
      .catch(() => snackbar.showError('Erreur'))
      .finally(() => setSaving(false));
  };

  if (loading) return <Box p={4}><CircularProgress /></Box>;

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/app/technicians')} sx={{ mb: 2 }}>Retour</Button>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Règles d'affectation</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Liez chaque type d'ordre de travail aux compétences requises (niveau 1-5). Les suggestions d'affectation utiliseront ces règles.
      </Typography>

      {canEdit && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Ajouter une liaison</Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Type d'OT</InputLabel>
                  <Select value={newTypeId} label="Type d'OT" onChange={(e) => setNewTypeId(e.target.value)}>
                    {types.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Compétence requise</InputLabel>
                  <Select value={newCompId} label="Compétence requise" onChange={(e) => setNewCompId(e.target.value)}>
                    {competencies.map((c) => <MenuItem key={c.id} value={c.id}>{c.name} ({c.code})</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Niveau min.</InputLabel>
                  <Select value={newLevel} label="Niveau min." onChange={(e) => setNewLevel(Number(e.target.value))}>
                    {[1, 2, 3, 4, 5].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button variant="contained" startIcon={<Add />} onClick={handleAdd} disabled={saving || !newTypeId || !newCompId}>Ajouter</Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Liaisons type ↔ compétence</Typography>
          {links.length === 0 ? (
            <Typography color="text.secondary">Aucune règle. Ajoutez des liaisons pour que les suggestions d'affectation (dans un OT) proposent les techniciens selon leurs compétences.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Type d'OT</TableCell>
                  <TableCell>Compétence</TableCell>
                  <TableCell>Niveau minimum</TableCell>
                  {canEdit && <TableCell align="right">Action</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {links.map((l) => (
                  <TableRow key={`${l.work_order_type_id}-${l.competence_id}`}>
                    <TableCell>{l.type_name}</TableCell>
                    <TableCell>{l.competence_name} ({l.competence_code})</TableCell>
                    <TableCell>{l.required_level}</TableCell>
                    {canEdit && (
                      <TableCell align="right">
                        <IconButton size="small" color="error" onClick={() => handleRemove(l.work_order_type_id, l.competence_id)}><Delete /></IconButton>
                      </TableCell>
                    )}
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
