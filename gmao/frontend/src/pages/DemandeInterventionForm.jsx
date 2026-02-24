import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Alert,
  CircularProgress,
  Link,
  alpha,
  useTheme,
  Chip,
  Divider
} from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import api from '../services/api';
import { getApiErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';

const PRIORITY_LABELS = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  critical: 'Critique'
};

export default function DemandeInterventionForm() {
  const theme = useTheme();
  const { user } = useAuth();
  const primary = theme.palette.primary.main;
  const [equipment, setEquipment] = useState([]);
  const [loadingEquipment, setLoadingEquipment] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    equipmentId: '',
    priority: 'medium'
  });

  useEffect(() => {
    api.get('/equipment', { params: { limit: 500 } })
      .then((r) => {
        const data = r.data?.data ?? r.data;
        setEquipment(Array.isArray(data) ? data : []);
      })
      .catch(() => setEquipment([]))
      .finally(() => setLoadingEquipment(false));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess(null);
    if (!form.title.trim()) {
      setError('Veuillez indiquer l\'objet de la demande.');
      return;
    }
    setSubmitting(true);
    api.post('/intervention-requests', {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      equipmentId: form.equipmentId ? parseInt(form.equipmentId, 10) : undefined,
      priority: form.priority
    })
      .then((r) => {
        setSuccess({
          number: r.data?.number || r.data?.id,
          message: 'Votre demande a bien été enregistrée. Les équipes de maintenance en ont été notifiées.'
        });
        setForm({ title: '', description: '', equipmentId: '', priority: 'medium' });
        try {
          const ch = new BroadcastChannel('gmao-intervention-request');
          ch.postMessage({ type: 'created' });
          ch.close();
        } catch (_) {}
      })
      .catch((err) => setError(getApiErrorMessage(err, 'Impossible d\'enregistrer la demande.')))
      .finally(() => setSubmitting(false));
  };

  const requesterLabel = user ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email : '';

  const headerBranding = (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, flexWrap: 'wrap' }}>
      <Typography
        component="span"
        sx={{
          fontSize: { xs: '1.5rem', sm: '1.75rem' },
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: '#1a1a1a',
          lineHeight: 1.2
        }}
      >
        MAINT
      </Typography>
      <Typography component="span" sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' }, fontWeight: 800, letterSpacing: '-0.03em', color: primary, lineHeight: 1.2 }}>
        X
      </Typography>
      <Typography component="span" sx={{ ml: 1, fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.04em', color: alpha(primary, 0.9) }}>
        GMAO
      </Typography>
    </Box>
  );

  if (success) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: `linear-gradient(160deg, ${alpha(primary, 0.08)} 0%, ${theme.palette.background.default} 40%, ${alpha(primary, 0.04)} 100%)`,
          py: 4,
          px: 2
        }}
      >
        <Container maxWidth="sm">
          <Paper
            elevation={0}
            sx={{
              p: 4,
              borderRadius: 3,
              border: `1px solid ${alpha(primary, 0.2)}`,
              boxShadow: `0 8px 32px ${alpha(primary, 0.12)}`,
              overflow: 'hidden'
            }}
          >
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  bgcolor: alpha(primary, 0.12),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto'
                }}
              >
                <CheckCircleIcon sx={{ fontSize: 44, color: 'success.main' }} />
              </Box>
              <Typography variant="h5" sx={{ mt: 2, fontWeight: 700, color: 'text.primary' }}>
                Demande enregistrée
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                Numéro de demande : <strong style={{ color: primary }}>{success.number}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {success.message}
              </Typography>
            </Box>
            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button variant="outlined" onClick={() => setSuccess(null)} sx={{ borderColor: alpha(primary, 0.5), color: primary }}>
                Déposer une autre demande
              </Button>
              <Button
                component={RouterLink}
                to="/app"
                variant="contained"
                sx={{
                  background: `linear-gradient(135deg, ${primary} 0%, ${theme.palette.primary.dark} 100%)`,
                  boxShadow: `0 4px 14px ${alpha(primary, 0.4)}`
                }}
              >
                Retour à l&#39;application
              </Button>
            </Box>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `linear-gradient(160deg, ${alpha(primary, 0.06)} 0%, ${theme.palette.background.default} 35%, ${alpha(primary, 0.04)} 100%)`
      }}
    >
      <Box
        component="header"
        sx={{
          py: 2.5,
          px: 2,
          borderBottom: `2px solid ${alpha(primary, 0.15)}`,
          background: `linear-gradient(90deg, ${alpha(primary, 0.08)} 0%, ${alpha(theme.palette.primary.light, 0.12)} 100%)`,
          boxShadow: `0 2px 12px ${alpha(primary, 0.08)}`
        }}
      >
        <Container maxWidth="md">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Link
              component={RouterLink}
              to="/app"
              underline="none"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                color: 'text.primary',
                fontWeight: 600,
                '&:hover': { color: primary }
              }}
            >
              <ArrowBackIcon /> Retour à l&#39;application
            </Link>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              {headerBranding}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <BuildIcon sx={{ color: primary, fontSize: 28 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  Demande d&#39;intervention
                </Typography>
              </Box>
              {requesterLabel && (
                <Chip
                  size="small"
                  icon={<PersonIcon sx={{ fontSize: 18 }} />}
                  label={`Connecté : ${requesterLabel}`}
                  sx={{
                    bgcolor: alpha(primary, 0.1),
                    color: theme.palette.primary.dark,
                    border: `1px solid ${alpha(primary, 0.3)}`,
                    fontWeight: 600
                  }}
                />
              )}
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: 4, px: 2 }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            border: `1px solid ${alpha(primary, 0.2)}`,
            boxShadow: `0 8px 32px ${alpha(primary, 0.08)}`,
            overflow: 'hidden'
          }}
        >
          <Box sx={{ mb: 3, pb: 2, borderBottom: `2px solid ${alpha(primary, 0.15)}` }}>
            {headerBranding}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, maxWidth: 560 }}>
              Ce formulaire nécessite un accès identifié. La demande sera enregistrée à votre nom. Les équipes traiteront votre demande et vous pourrez la suivre dans l&#39;application (Demandes d&#39;intervention).
            </Typography>
          </Box>

          <form onSubmit={handleSubmit}>
            {error && (
              <Alert severity="error" onClose={() => setError('')} sx={{ mb: 3 }} variant="filled">
                {error}
              </Alert>
            )}

            <TextField
              fullWidth
              label="Objet de la demande"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              margin="normal"
              placeholder="Ex. Panne machine, contrôle périodique..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&.Mui-focused fieldset': { borderColor: primary, borderWidth: 2 }
                }
              }}
            />
            <TextField
              fullWidth
              label="Description (optionnel)"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              multiline
              rows={3}
              margin="normal"
              placeholder="Décrivez le problème ou le besoin..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&.Mui-focused fieldset': { borderColor: primary, borderWidth: 2 }
                }
              }}
            />

            <FormControl fullWidth margin="normal" disabled={loadingEquipment} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
              <InputLabel>Équipement concerné (optionnel)</InputLabel>
              <Select
                value={form.equipmentId}
                label="Équipement concerné (optionnel)"
                onChange={(e) => setForm((f) => ({ ...f, equipmentId: e.target.value }))}
              >
                <MenuItem value="">— Aucun / Non identifié —</MenuItem>
                {equipment.map((eq) => (
                  <MenuItem key={eq.id} value={eq.id}>
                    {[eq.code, eq.name].filter(Boolean).join(' — ') || `Équipement #${eq.id}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
              <InputLabel>Priorité</InputLabel>
              <Select
                value={form.priority}
                label="Priorité"
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              >
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <MenuItem key={k} value={k}>{v}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Divider sx={{ my: 3 }} />

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button
                component={RouterLink}
                to="/app"
                variant="outlined"
                sx={{ borderRadius: 2, borderColor: alpha(primary, 0.5), color: primary }}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={submitting}
                startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <BuildIcon />}
                sx={{
                  borderRadius: 2,
                  px: 3,
                  background: `linear-gradient(135deg, ${primary} 0%, ${theme.palette.primary.dark} 100%)`,
                  boxShadow: `0 4px 14px ${alpha(primary, 0.35)}`,
                  '&:hover': { boxShadow: `0 6px 20px ${alpha(primary, 0.45)}` }
                }}
              >
                {submitting ? 'Envoi...' : 'Envoyer la demande'}
              </Button>
            </Box>
          </form>
        </Paper>
      </Container>
    </Box>
  );
}
