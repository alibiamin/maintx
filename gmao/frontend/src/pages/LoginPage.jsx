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
  useTheme,
  Tooltip,
  Link,
  IconButton,
  Menu,
  MenuItem
} from '@mui/material';
import { Language as LanguageIcon } from '@mui/icons-material';
import {
  Build,
  Assignment,
  Inventory,
  CalendarMonth,
  Security,
  Email
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

// Liens sociaux — à personnaliser avec vos URLs
const SOCIAL_LINKS = [
  { id: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/maintx', icon: 'fb', color: '#1877f2' },
  { id: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/company/maintx', icon: 'in', color: '#0a66c2' },
  { id: 'x', label: 'X (Twitter)', href: 'https://x.com/maintx', icon: 'x', color: '#000' },
  { id: 'mail', label: 'Email', href: 'mailto:contact@maintx.org', icon: 'mail', color: '#2EB23E' }
];

const features = [
  { icon: Build, label: 'Équipements & suivi' },
  { icon: Assignment, label: 'Ordres de travail' },
  { icon: CalendarMonth, label: 'Planning préventif' },
  { icon: Inventory, label: 'Stock & pièces' }
];

/** Icônes sociales (SVG) pour Facebook, LinkedIn, X, Mail */
function SocialIcon({ icon, color, size = 24 }) {
  const s = size;
  const common = { width: s, height: s, fill: color };
  if (icon === 'fb') {
    return (
      <Box component="svg" viewBox="0 0 24 24" sx={common}>
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </Box>
    );
  }
  if (icon === 'in') {
    return (
      <Box component="svg" viewBox="0 0 24 24" sx={common}>
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </Box>
    );
  }
  if (icon === 'x') {
    return (
      <Box component="svg" viewBox="0 0 24 24" sx={common}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </Box>
    );
  }
  return <Email sx={{ fontSize: s, color }} />;
}

const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'de', label: 'Deutsch' }
];

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [langAnchor, setLangAnchor] = useState(null);
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
      setError(err.response?.data?.error || t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  const fadeInUp = {
    '@keyframes fadeInUp': {
      from: { opacity: 0, transform: 'translateY(12px)' },
      to: { opacity: 1, transform: 'translateY(0)' }
    }
  };
  const socialEntrance = {
    animation: 'fadeInUp 0.6s ease-out forwards',
    ...fadeInUp
  };
  const brandFadeIn = {
    '@keyframes brandFadeIn': {
      from: { opacity: 0, transform: 'translateY(8px)' },
      to: { opacity: 1, transform: 'translateY(0)' }
    },
    animation: 'brandFadeIn 0.8s ease-out forwards'
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
        <Box sx={{ position: 'relative', zIndex: 1, ...brandFadeIn }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
            <Box component="img" src="/maintx-logo.png" alt="MAINTX" sx={{ maxWidth: 'min(280px, 100%)', height: 'auto' }} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Logo variant="dark" size="medium" showText={false} logoSrc={null} sx={{ flexShrink: 0 }} />
            <Box sx={{ borderLeft: '1px solid', borderColor: 'divider', pl: 2 }}>
              <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500, letterSpacing: '0.02em' }}>
                {t('login.tagline')}
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

        {/* Raccourcis réseaux sociaux — panneau gauche */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 2,
            pt: 2,
            ...socialEntrance
          }}
        >
          {SOCIAL_LINKS.map((link) => (
            <Tooltip key={link.id} title={link.label} placement="top">
              <Link
                href={link.href}
                target={link.id === 'mail' ? '_self' : '_blank'}
                rel={link.id === 'mail' ? undefined : 'noopener noreferrer'}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'text.secondary',
                  transition: 'all 0.25s ease',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.18),
                    transform: 'scale(1.1)',
                    color: link.color
                  }
                }}
              >
                <SocialIcon icon={link.icon} color="currentColor" size={22} />
              </Link>
            </Tooltip>
          ))}
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
        <IconButton
          onClick={(e) => setLangAnchor(e.currentTarget)}
          sx={{ position: 'absolute', top: 16, right: 16, color: 'rgba(255,255,255,0.9)' }}
          aria-label={t('common.language')}
        >
          <LanguageIcon />
        </IconButton>
        <Menu
          anchorEl={langAnchor}
          open={!!langAnchor}
          onClose={() => setLangAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          {LANGUAGES.map((lang) => (
            <MenuItem
              key={lang.code}
              selected={i18n.language === lang.code}
              onClick={() => { i18n.changeLanguage(lang.code); setLangAnchor(null); }}
            >
              {lang.label}
            </MenuItem>
          ))}
        </Menu>
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
              {t('login.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {t('login.subtitle')}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label={t('login.email')}
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
                label={t('login.password')}
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
                {loading ? t('login.submitting') : t('login.submit')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Typography variant="caption" sx={{ position: 'absolute', bottom: 16, left: 16, right: 16, textAlign: 'center', color: 'rgba(255,255,255,0.85)' }}>
          © MainteniX — Gestion de Maintenance
        </Typography>
      </Box>
    </Box>
  );
}
