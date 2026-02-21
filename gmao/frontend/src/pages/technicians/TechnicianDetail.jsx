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
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert
} from '@mui/material';
import { ArrowBack, Star, Edit, Add } from '@mui/icons-material';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSnackbar } from '../../context/SnackbarContext';

const roleLabels = { technicien: 'Technicien', responsable_maintenance: 'Responsable maintenance' };

export default function TechnicianDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tech, setTech] = useState(null);
  const [competencies, setCompetencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editCompetencies, setEditCompetencies] = useState(false);
  const [selectedComps, setSelectedComps] = useState([]); // [{ competence_id, level }]
  const [evalOpen, setEvalOpen] = useState(false);
  const [evalScore, setEvalScore] = useState(3);
  const [evalComment, setEvalComment] = useState('');
  const [evalWoId, setEvalWoId] = useState('');
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const canEdit = ['administrateur', 'responsable_maintenance'].includes(user?.role);

  useEffect(() => {
    Promise.all([
      api.get(`/technicians/${id}`),
      api.get('/competencies').catch(() => [])
    ]).then(([r, comps]) => {
      setTech(r.data);
      setCompetencies(comps.data || comps);
      setSelectedComps((r.data.competencies || []).map(c => ({ competence_id: c.competence_id, level: c.level })));
    }).catch(() => navigate('/technicians')).finally(() => setLoading(false));
  }, [id, navigate]);

  const handleSaveCompetencies = () => {
    setSaving(true);
    api.put(`/technicians/${id}/competencies`, { competencies: selectedComps })
      .then(() => {
        setTech(prev => ({
          ...prev,
          competencies: selectedComps.map(c => ({
            competence_id: c.competence_id,
            level: c.level,
            name: competencies.find(x => x.id === c.competence_id)?.name ?? '',
            code: competencies.find(x => x.id === c.competence_id)?.code ?? ''
          }))
        }));
        setEditCompetencies(false);
        snackbar.showSuccess('Compétences mises à jour');
      })
      .catch(() => snackbar.showError('Erreur'))
      .finally(() => setSaving(false));
  };

  const handleAddComp = () => {
    const firstId = competencies[0]?.id;
    if (firstId && !selectedComps.some(c => c.competence_id === firstId))
      setSelectedComps([...selectedComps, { competence_id: firstId, level: 1 }]);
  };

  const handleRemoveComp = (competence_id) => {
    setSelectedComps(selectedComps.filter(c => c.competence_id !== competence_id));
  };

  const handleLevelChange = (competence_id, level) => {
    setSelectedComps(selectedComps.map(c => c.competence_id === competence_id ? { ...c, level: parseInt(level, 10) } : c));
  };

  const handleSubmitEval = () => {
    setSaving(true);
    api.post(`/technicians/${id}/evaluations`, { score: evalScore, comment: evalComment || undefined, work_order_id: evalWoId ? parseInt(evalWoId, 10) : undefined })
      .then(() => { setEvalOpen(false); setEvalScore(3); setEvalComment(''); setEvalWoId(''); loadTech(); snackbar.showSuccess('Évaluation enregistrée'); })
      .catch(() => snackbar.showError('Erreur'))
      .finally(() => setSaving(false));
  };

  const loadTech = () => {
    api.get(`/technicians/${id}`).then(r => setTech(r.data)).catch(() => {});
  };

  if (loading || !tech) return <Box p={4}><CircularProgress /></Box>;

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/technicians')} sx={{ mb: 2 }}>Retour</Button>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={700}>{tech.first_name} {tech.last_name}</Typography>
              <Chip label={roleLabels[tech.role_name] || tech.role_name} size="small" color="primary" sx={{ mt: 1 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{tech.email}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 2 }}>
                <Star sx={{ color: 'warning.main' }} />
                <Typography fontWeight={600}>{tech.avg_score != null ? `${tech.avg_score}/5` : 'Aucune note'} ({tech.evaluation_count} évaluation(s))</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={700}>Compétences</Typography>
                {canEdit && !editCompetencies && (
                  <Button size="small" startIcon={<Edit />} onClick={() => setEditCompetencies(true)}>Modifier</Button>
                )}
                {canEdit && editCompetencies && (
                  <Box display="flex" gap={1}>
                    <Button size="small" onClick={() => setEditCompetencies(false)}>Annuler</Button>
                    <Button size="small" variant="contained" disabled={saving} onClick={handleSaveCompetencies}>Enregistrer</Button>
                  </Box>
                )}
              </Box>
              {!editCompetencies ? (
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {(tech.competencies || []).length === 0 ? (
                    <Typography color="text.secondary">Aucune compétence renseignée</Typography>
                  ) : (
                    tech.competencies.map((c) => (
                      <Chip key={c.competence_id} label={`${c.name} — Niveau ${c.level}`} size="medium" color="primary" variant="outlined" />
                    ))
                  )}
                </Box>
              ) : (
                <Box>
                  {selectedComps.map((sc) => (
                    <Box key={sc.competence_id} display="flex" alignItems="center" gap={2} sx={{ mb: 1 }}>
                      <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Compétence</InputLabel>
                        <Select
                          value={sc.competence_id}
                          label="Compétence"
                          onChange={(e) => {
                            const newId = e.target.value;
                            const idx = selectedComps.findIndex(c => c.competence_id === sc.competence_id);
                            const next = [...selectedComps];
                            next[idx] = { competence_id: newId, level: next[idx].level };
                            setSelectedComps(next);
                          }}
                        >
                          {competencies.map((c) => (
                            <MenuItem key={c.id} value={c.id}>{c.name} ({c.code})</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl size="small" sx={{ minWidth: 100 }}>
                        <InputLabel>Niveau</InputLabel>
                        <Select value={sc.level} label="Niveau" onChange={(e) => handleLevelChange(sc.competence_id, e.target.value)}>
                          {[1, 2, 3, 4, 5].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                        </Select>
                      </FormControl>
                      <Button size="small" color="error" onClick={() => handleRemoveComp(sc.competence_id)}>Retirer</Button>
                    </Box>
                  ))}
                  <Button size="small" startIcon={<Add />} onClick={handleAddComp} sx={{ mt: 1 }}>Ajouter une compétence</Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={700}>Évaluations</Typography>
                {canEdit && (
                  <Button size="small" variant="outlined" startIcon={<Add />} onClick={() => setEvalOpen(true)}>Ajouter une évaluation</Button>
                )}
              </Box>
              {tech.evaluations?.length === 0 ? (
                <Typography color="text.secondary">Aucune évaluation</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Score</TableCell>
                      <TableCell>Évaluateur</TableCell>
                      <TableCell>OT</TableCell>
                      <TableCell>Commentaire</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tech.evaluations?.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{new Date(e.created_at).toLocaleDateString('fr-FR')}</TableCell>
                        <TableCell><Chip label={`${e.score}/5`} size="small" color="primary" /></TableCell>
                        <TableCell>{e.evaluator_name}</TableCell>
                        <TableCell>{e.work_order_number ? `${e.work_order_number} — ${e.work_order_title}` : '—'}</TableCell>
                        <TableCell>{e.comment || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={evalOpen} onClose={() => setEvalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouvelle évaluation</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>Score (1-5)</InputLabel>
            <Select value={evalScore} label="Score (1-5)" onChange={(e) => setEvalScore(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth label="Commentaire" multiline rows={2} value={evalComment} onChange={(e) => setEvalComment(e.target.value)} sx={{ mt: 2 }} />
          <TextField fullWidth label="ID OT (optionnel)" value={evalWoId} onChange={(e) => setEvalWoId(e.target.value)} sx={{ mt: 1 }} placeholder="Lier à un ordre de travail" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEvalOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSubmitEval} disabled={saving}>Enregistrer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
