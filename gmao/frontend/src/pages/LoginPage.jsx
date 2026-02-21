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
import AppLoadingScreen from '../components/AppLoadingScreen';

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

import { LANGUAGES } from '../constants/languages';

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
    const startedAt = Date.now();
    try {
      await login(email, password);
      const elapsed = Date.now() - startedAt;
      const minDisplayMs = 3000;
      if (elapsed < minDisplayMs) {
        await new Promise((r) => setTimeout(r, minDisplayMs - elapsed));
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <AppLoadingScreen />;

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

  // Animations dédiées MAINTX et GMAO (entrée échelonnée + léger rebond)
  const maintxKeyframes = {
    '@keyframes maintxEntrance': {
      '0%': { opacity: 0, transform: 'translateY(20px) scale(0.98)' },
      '70%': { transform: 'translateY(-4px) scale(1.01)' },
      '100%': { opacity: 1, transform: 'translateY(0) scale(1)' }
    }
  };
  const gmaoKeyframes = {
    '@keyframes gmaoEntrance': {
      '0%': { opacity: 0, transform: 'translateY(16px)' },
      '100%': { opacity: 1, transform: 'translateY(0)' }
    }
  };
  const maintxAnimation = {
    ...maintxKeyframes,
    animation: 'maintxEntrance 0.85s cubic-bezier(0.22, 1, 0.36, 1) forwards'
  };
  const gmaoAnimation = {
    ...gmaoKeyframes,
    animation: 'gmaoEntrance 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.2s forwards',
    opacity: 0
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        overflow: 'hidden'
      }}
    >
      {/* Panneau gauche — fond blanc + arrière-plan thématique GMAO (grille technique, orbes douces) */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#ffffff',
          p: 4,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Arrière-plan créatif : grille type plan technique + orbes douces (thème maintenance / équipements) */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
            backgroundImage: `
              linear-gradient(${alpha(theme.palette.primary.main, 0.06)} 1px, transparent 1px),
              linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.06)} 1px, transparent 1px)
            `,
            backgroundSize: '28px 28px'
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
            background: `
              radial-gradient(ellipse 80% 50% at 20% 20%, ${alpha(theme.palette.primary.main, 0.06)} 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 85% 80%, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 45%)
            `
          }}
        />
        <Box sx={{ position: 'relative', zIndex: 1, ...brandFadeIn }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', mb: 3, gap: 0.25 }}>
            <Box sx={maintxAnimation}>
              <Typography
                component="span"
                sx={{
                  fontSize: { xs: '3.5rem', sm: '4.25rem', md: '5rem' },
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  color: '#1a1a1a',
                  lineHeight: 1.1,
                  textShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  display: 'block',
                  textAlign: 'center'
                }}
              >
                MAINT<Box component="span" sx={{ color: theme.palette.primary.main }}>X</Box>
              </Typography>
            </Box>
            <Box
              sx={{
                ...gmaoAnimation,
                borderBottom: '2px solid',
                borderColor: alpha(theme.palette.primary.main, 0.9),
                pb: 0.4,
                alignSelf: 'center'
              }}
            >
              <Typography
                component="span"
                sx={{
                  fontSize: { xs: '2.75rem', sm: '3.5rem', md: '4rem' },
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: theme.palette.primary.main,
                  lineHeight: 1.2,
                  textShadow: '0 1px 2px rgba(0,0,0,0.06)',
                  display: 'block',
                  textAlign: 'center'
                }}
              >
                GMAO
              </Typography>
            </Box>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              mb: 2,
              pl: 2,
              borderLeft: '3px solid',
              borderColor: theme.palette.primary.main,
              maxWidth: 360
            }}
          >
            <Typography
              variant="subtitle1"
              sx={{
                color: 'text.primary',
                fontWeight: 500,
                letterSpacing: '0.02em',
                lineHeight: 1.5,
                fontSize: '1.05rem'
              }}
            >
              {(() => {
                const tagline = t('login.tagline');
                const parts = tagline.split('GMAO');
                if (parts.length === 2) {
                  return (
                    <>
                      {parts[0]}
                      <Box component="span" sx={{ color: theme.palette.primary.main, fontWeight: 700 }}>GMAO</Box>
                      {parts[1]}
                    </>
                  );
                }
                return tagline;
              })()}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 2, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Au cœur de votre maintenance
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 2
            }}
          >
            {features.map(({ icon: Icon, label }) => (
              <Card
                key={label}
                elevation={0}
                sx={{
                  position: 'relative',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha('#fff', 0.98)} 50%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                  border: '1px solid',
                  borderColor: alpha(theme.palette.primary.main, 0.22),
                  boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.1)} inset, 0 4px 14px ${alpha('#000', 0.06)}`,
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: `linear-gradient(90deg, transparent, ${theme.palette.primary.main}, transparent)`,
                    opacity: 0.6
                  }
                }}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '14px',
                        background: `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.22)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%)`,
                        border: '1px solid',
                        borderColor: alpha(theme.palette.primary.main, 0.4),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: `0 0 12px ${alpha(theme.palette.primary.main, 0.15)}`
                      }}
                    >
                      <Icon sx={{ fontSize: 24, color: 'primary.main', filter: 'drop-shadow(0 0 6px rgba(46, 178, 62, 0.25))' }} />
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.primary',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        lineHeight: 1.25,
                        textShadow: `0 1px 2px ${alpha('#fff', 0.8)}`
                      }}
                    >
                      {label}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
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
              <Box component="span" sx={{ mr: 1.5, fontSize: '1.25rem' }}>{lang.flag}</Box>
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
          © MaintX{' '}
          <Box component="span" sx={{ color: '#2EB23E', fontWeight: 700 }}>GMAO</Box>
          {' '}— Gestion de Maintenance
        </Typography>
      </Box>
    </Box>
  );
}
