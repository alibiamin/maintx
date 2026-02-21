import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  alpha,
  useTheme
} from '@mui/material';
import {
  Build,
  Assignment,
  Inventory,
  CalendarMonth,
  Security
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

const features = [
  { icon: Build, label: 'Équipements & suivi' },
  { icon: Assignment, label: 'Ordres de travail' },
  { icon: CalendarMonth, label: 'Planning préventif' },
  { icon: Inventory, label: 'Stock & pièces' }
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        overflow: 'hidden'
      }}
    >
      {/* Panneau gauche — Blanc avec image logo */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
          bgcolor: '#fff',
          p: 4,
          position: 'relative'
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
            <Box component="img" src="/maintx-logo.png" alt="MAINTX" sx={{ maxWidth: 'min(280px, 100%)', height: 'auto' }} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Logo variant="dark" size="medium" showText={false} logoSrc={null} sx={{ flexShrink: 0 }} />
            <Box sx={{ borderLeft: '1px solid', borderColor: 'divider', pl: 2 }}>
              <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500, letterSpacing: '0.02em' }}>
                Gestion de maintenance — xmaint.org
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 2, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Au cœur de votre maintenance
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {features.map(({ icon: Icon, label }) => (
              <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon sx={{ fontSize: 20, color: 'primary.main' }} />
                </Box>
                <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500 }}>
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Security sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Connexion sécurisée
          </Typography>
        </Box>

        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: 0.04,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 5 L35 20 L50 25 L35 30 L30 45 L25 30 L10 25 L25 20 Z' fill='%23000' fill-opacity='1'/%3E%3C/svg%3E")`
          }}
        />
      </Box>

      {/* Panneau droit — Vert avec formulaire */}
      <Box
        sx={{
          flex: { xs: 1, md: '0 0 440px' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
          background: `linear-gradient(160deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 45%, ${alpha(theme.palette.primary.light, 0.9)} 100%)`,
          position: 'relative'
        }}
      >
        <Card
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 400,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            boxShadow: theme.shadows[2]
          }}
        >
          <CardContent sx={{ p: 4 }}>
            {/* En-tête visible sur mobile — logo adapté à l'interface */}
            <Box sx={{ display: { xs: 'flex', md: 'none' }, mb: 3, justifyContent: 'center' }}>
              <Logo variant="dark" size="medium" />
            </Box>

            <Typography variant="h6" fontWeight={700} color="text.primary" sx={{ mb: 0.5 }}>
              Connexion
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Accédez à votre espace de gestion de maintenance
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Adresse email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                sx={{ mb: 2 }}
                InputProps={{ sx: { borderRadius: 2 } }}
              />
              <TextField
                fullWidth
                label="Mot de passe"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                sx={{ mb: 2 }}
                InputProps={{ sx: { borderRadius: 2 } }}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 700,
                  textTransform: 'none',
                  fontSize: '1rem',
                  boxShadow: 2
                }}
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </Button>
            </form>

            <Typography variant="caption" display="block" sx={{ mt: 2.5 }} color="text.secondary" align="center">
              Démo : admin@maintenix.com / Password123!
            </Typography>
          </CardContent>
        </Card>

        <Typography variant="caption" sx={{ position: 'absolute', bottom: 16, left: 16, right: 16, textAlign: 'center', color: 'rgba(255,255,255,0.85)' }}>
          © MainteniX — Gestion de Maintenance
        </Typography>
      </Box>
    </Box>
  );
}
