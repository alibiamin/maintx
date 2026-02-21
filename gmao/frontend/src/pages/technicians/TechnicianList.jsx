import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  CircularProgress,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import { PersonAdd, Star } from '@mui/icons-material';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSnackbar } from '../../context/SnackbarContext';
import { useCurrency } from '../../context/CurrencyContext';

const roleLabels = { technicien: 'Technicien', responsable_maintenance: 'Responsable maintenance' };

function TechnicianList() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', firstName: '', lastName: '', hourlyRate: '',
    phone: '', address: '', city: '', postalCode: '', employeeNumber: '',
    jobTitle: '', department: '', hireDate: '', contractType: ''
  });
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const currency = useCurrency();
  const canAdd = ['administrateur', 'responsable_maintenance'].includes(user?.role);

  const load = () => {
    api.get('/technicians').then(r => setList(r.data)).catch(() => setList([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleOpenDialog = () => {
    setForm({
      email: '', password: '', firstName: '', lastName: '', hourlyRate: '',
      phone: '', address: '', city: '', postalCode: '', employeeNumber: '',
      jobTitle: '', department: '', hireDate: '', contractType: ''
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => setDialogOpen(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.email?.trim() || !form.password || form.password.length < 8 || !form.firstName?.trim() || !form.lastName?.trim()) {
      snackbar.showError('Tous les champs sont requis (mot de passe min. 8 caractères)');
      return;
    }
    setSaving(true);
    api.post('/technicians', {
      email: form.email.trim(),
      password: form.password,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      hourlyRate: form.hourlyRate.trim() ? parseFloat(form.hourlyRate.replace(',', '.')) : undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      postalCode: form.postalCode.trim() || undefined,
      employeeNumber: form.employeeNumber.trim() || undefined,
      jobTitle: form.jobTitle.trim() || undefined,
      department: form.department.trim() || undefined,
      hireDate: form.hireDate || undefined,
      contractType: form.contractType.trim() || undefined
    })
      .then((r) => {
        setDialogOpen(false);
        load();
        snackbar.showSuccess('Technicien créé.');
        if (r.data?.id) navigate(`/technicians/${r.data.id}`);
      })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur lors de la création'))
      .finally(() => setSaving(false));
  };

  if (loading) return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Techniciens</Typography>
          <Typography variant="body2" color="text.secondary">Compétences, notation et suggestions d'affectation</Typography>
        </Box>
        {canAdd && (
          <Button variant="contained" startIcon={<PersonAdd />} onClick={handleOpenDialog}>
            Ajouter un technicien
          </Button>
        )}
      </Box>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth component="form" onSubmit={handleSubmit}>
        <DialogTitle>Nouveau technicien</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" color="primary" sx={{ mt: 1, mb: 0.5 }}>Compte</Typography>
          <TextField fullWidth label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} margin="dense" autoComplete="email" />
          <TextField fullWidth label="Mot de passe" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} margin="dense" helperText="Minimum 8 caractères" autoComplete="new-password" />
          <TextField fullWidth label="Prénom" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} margin="dense" />
          <TextField fullWidth label="Nom" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} margin="dense" />
          <TextField fullWidth label={`Taux horaire (${currency}/h)`} type="number" placeholder="Optionnel" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} margin="dense" inputProps={{ min: 0, step: 0.01 }} />
          <Typography variant="subtitle2" color="primary" sx={{ mt: 2, mb: 0.5 }}>Infos personnelles</Typography>
          <TextField fullWidth label="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} margin="dense" />
          <TextField fullWidth label="Adresse" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} margin="dense" />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField fullWidth label="Ville" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} margin="dense" />
            <TextField label="Code postal" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} margin="dense" sx={{ width: 120 }} />
          </Box>
          <TextField fullWidth label="Matricule" value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} margin="dense" placeholder="Optionnel" />
          <Typography variant="subtitle2" color="primary" sx={{ mt: 2, mb: 0.5 }}>Infos techniques</Typography>
          <TextField fullWidth label="Fonction / Poste" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} margin="dense" />
          <TextField fullWidth label="Service / Département" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} margin="dense" />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField fullWidth label="Date d'entrée" type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} margin="dense" InputLabelProps={{ shrink: true }} />
            <TextField fullWidth label="Type de contrat" value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })} margin="dense" placeholder="CDI, CDD…" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Annuler</Button>
          <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Création...' : 'Créer'}</Button>
        </DialogActions>
      </Dialog>

      <Grid container spacing={2}>
        {list.length === 0 ? (
          <Grid item xs={12}>
            <Card><CardContent><Typography color="text.secondary">Aucun technicien (rôle Technicien ou Responsable maintenance). Créez un utilisateur avec ce rôle dans Création.</Typography></CardContent></Card>
          </Grid>
        ) : (
          list.map((t) => (
            <Grid item xs={12} sm={6} md={4} key={t.id}>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s',
                  '&:hover': { boxShadow: 4 }
                }}
                onClick={() => navigate(`/technicians/${t.id}`)}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography variant="h6" fontWeight={600}>{t.first_name} {t.last_name}</Typography>
                    <Chip label={roleLabels[t.role_name] || t.role_name} size="small" color="primary" variant="outlined" />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t.email}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <Star sx={{ fontSize: 18, color: 'warning.main' }} />
                    <Typography variant="body2" fontWeight={600}>
                      {t.avg_score != null ? `${t.avg_score}/5` : '—'} ({t.evaluation_count} éval.)
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Taux : {t.hourly_rate != null ? `${Number(t.hourly_rate).toFixed(2)} ${currency}/h` : 'défaut'}
                  </Typography>
                  {(t.phone || t.job_title || t.department || t.city) && (
                    <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                      {t.phone && <Typography variant="caption" display="block" color="text.secondary">Tél. {t.phone}</Typography>}
                      {(t.job_title || t.department) && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {[t.job_title, t.department].filter(Boolean).join(' · ')}
                        </Typography>
                      )}
                      {(t.city || t.address) && (
                        <Typography variant="caption" display="block" color="text.secondary" noWrap title={[t.address, t.city, t.postal_code].filter(Boolean).join(' ')}>
                          {t.city || t.address}
                        </Typography>
                      )}
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {t.competencies?.slice(0, 4).map((c) => (
                      <Chip key={c.competence_id} label={`${c.name} ${c.level}`} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                    ))}
                    {t.competencies?.length > 4 && <Chip label={`+${t.competencies.length - 4}`} size="small" />}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>
    </Box>
  );
}

export default TechnicianList;
