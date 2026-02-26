import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Stack, Grid, Card, CardContent, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { useTheme, alpha, keyframes } from '@mui/material/styles';
import { Login, ArrowForward, ArrowBack, Build, Assignment, Inventory, Schedule, List, Email, ContactMail, CheckCircle } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { getApiErrorMessage } from '../services/api';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1920&q=85&auto=format&fit=crop';
const CONTACT_EMAIL = 'admin@maintx.org';

/* Animations type Figma : entrées progressives, easing fluide */
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const scaleIn = keyframes`
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
`;

const softGlow = keyframes`
  0%, 100% { filter: drop-shadow(0 0 24px rgba(46, 178, 62, 0.35)); }
  50%      { filter: drop-shadow(0 0 48px rgba(46, 178, 62, 0.55)); }
`;

const blendShimmer = keyframes`
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

/* Animations arrière-plan uniquement */
const gridMove = keyframes`
  0%   { transform: translate(0, 0); }
  100% { transform: translate(50px, 50px); }
`;

const orbFloat1 = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.4; }
  33%      { transform: translate(30px, -20px) scale(1.05); opacity: 0.5; }
  66%      { transform: translate(-20px, 15px) scale(0.95); opacity: 0.35; }
`;

const orbFloat2 = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
  50%      { transform: translate(-40px, -30px) scale(1.1); opacity: 0.45; }
`;

const orbFloat3 = keyframes`
  0%, 100% { transform: translate(0, 0); opacity: 0.25; }
  50%      { transform: translate(25px, 25px); opacity: 0.4; }
`;

const lightSweep = keyframes`
  0%   { opacity: 0; transform: translateX(-100%) skewX(-12deg); }
  50%  { opacity: 0.15; }
  100% { opacity: 0; transform: translateX(100%) skewX(-12deg); }
`;

/* Transition épique vers la section offres */
const offersReveal = keyframes`
  from {
    opacity: 0;
    transform: translateY(48px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const offersCardStagger = keyframes`
  from {
    opacity: 0;
    transform: translateY(36px) scale(0.94);
    filter: blur(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
`;

const offersShine = keyframes`
  0%   { opacity: 0; transform: translateX(-100%) scaleX(0.5); }
  60%  { opacity: 0.4; }
  100% { opacity: 0; transform: translateX(100%) scaleX(0.5); }
`;

export default function Landing() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const green = theme.palette.primary.main;
  const [mounted, setMounted] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);
  const [demoForm, setDemoForm] = useState({ firstName: '', lastName: '', email: '', company: '', phone: '', message: '' });
  const [demoSubmitting, setDemoSubmitting] = useState(false);
  const [demoError, setDemoError] = useState('');
  const [demoSuccess, setDemoSuccess] = useState(false);
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    api.get('/public/offers')
      .then((res) => setOffers(Array.isArray(res.data?.plans) ? res.data.plans : []))
      .catch(() => setOffers([]));
  }, []);

  const handleDemoSubmit = (e) => {
    e.preventDefault();
    setDemoError('');
    setDemoSubmitting(true);
    api.post('/contact/demo', {
      firstName: demoForm.firstName.trim(),
      lastName: demoForm.lastName.trim(),
      email: demoForm.email.trim(),
      company: demoForm.company.trim() || undefined,
      phone: demoForm.phone.trim() || undefined,
      message: demoForm.message.trim() || undefined
    })
      .then(() => {
        setDemoSuccess(true);
        setDemoForm({ firstName: '', lastName: '', email: '', company: '', phone: '', message: '' });
        setTimeout(() => {
          setDemoDialogOpen(false);
          setDemoSuccess(false);
        }, 2000);
      })
      .catch((err) => setDemoError(getApiErrorMessage(err, t('landing.demoError'))))
      .finally(() => setDemoSubmitting(false));
  };

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        /* Couleur de fond avant chargement de l'image (évite le flash blanc) */
        backgroundColor: '#0a0e12',
        /* Image de fond */
        backgroundImage: `url(${HERO_IMAGE})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        /* Overlay blend : assombrit + teinte verte thème */
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: `
            linear-gradient(180deg, ${alpha('#0a0e12', 0.75)} 0%, ${alpha('#0a0e12', 0.5)} 40%, ${alpha('#0a0e12', 0.82)} 100%),
            linear-gradient(135deg, ${alpha(green, 0.12)} 0%, transparent 50%)
          `,
          backgroundSize: '200% 200%',
          animation: `${blendShimmer} 12s ease-in-out infinite`,
          pointerEvents: 'none'
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 70% 50% at 50% 50%, ${alpha(green, 0.08)} 0%, transparent 60%)`,
          pointerEvents: 'none'
        }
      }}
    >
      {/* ——— Animations arrière-plan (z-index 0) ——— */}
      {/* Grille en mouvement */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          backgroundImage: `
            linear-gradient(${alpha(green, 0.06)} 1px, transparent 1px),
            linear-gradient(90deg, ${alpha(green, 0.06)} 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          animation: `${gridMove} 25s linear infinite`,
          pointerEvents: 'none'
        }}
      />
      {/* Orbes flottantes */}
      <Box
    sx={{
      position: 'absolute',
          top: '20%',
          left: '15%',
          width: 'min(40vw, 320px)',
          height: 'min(40vw, 320px)',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(green, 0.2)} 0%, transparent 70%)`,
          filter: 'blur(40px)',
          animation: `${orbFloat1} 18s ease-in-out infinite`,
          pointerEvents: 'none',
          zIndex: 0
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '25%',
          right: '10%',
          width: 'min(35vw, 280px)',
          height: 'min(35vw, 280px)',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(green, 0.15)} 0%, transparent 70%)`,
          filter: 'blur(50px)',
          animation: `${orbFloat2} 22s ease-in-out infinite 2s`,
          pointerEvents: 'none',
          zIndex: 0
        }}
      />
        <Box
          sx={{
          position: 'absolute',
          top: '55%',
          left: '50%',
          width: 'min(25vw, 200px)',
          height: 'min(25vw, 200px)',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(green, 0.12)} 0%, transparent 70%)`,
          filter: 'blur(35px)',
          animation: `${orbFloat3} 15s ease-in-out infinite 1s`,
          pointerEvents: 'none',
          zIndex: 0
        }}
      />
      {/* Balayage lumineux passant */}
      <Box
            sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          background: `linear-gradient(90deg, transparent 0%, ${alpha(green, 0.08)} 50%, transparent 100%)`,
          animation: `${lightSweep} 8s ease-in-out infinite 3s`,
          pointerEvents: 'none'
        }}
      />

      {/* Conteneur flip 3D */}
      <Box
                  sx={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          perspective: '900px',
          perspectiveOrigin: '50% 50%',
          px: 2
                  }}
                >
                  <Box
                    sx={{
                      position: 'relative',
                      width: '100%',
                      maxWidth: 1200,
                      height: 'min(98vh, 1000px)',
                      minHeight: 720,
                      transformStyle: 'preserve-3d',
                      transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      transition: 'transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      willChange: 'transform'
                    }}
                  >
          {/* Face avant : hero + description moderne */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              px: 2
            }}
          >
            {/* Badge au-dessus du titre */}
            <Box
              component="span"
              sx={{
                display: 'inline-block',
                px: 2,
                py: 0.75,
                mb: 2,
                borderRadius: 100,
                border: `1px solid ${alpha(green, 0.4)}`,
                bgcolor: alpha(green, 0.08),
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.2em',
                color: green,
                textTransform: 'uppercase',
                animation: mounted ? `${fadeUp} 0.6s cubic-bezier(0.16, 1, 0.3, 1) both` : 'none'
              }}
            >
              {t('landing.tagline')}
            </Box>

            {/* Titre MAINTX */}
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: '4rem', sm: '7rem', md: '11rem', lg: '13rem' },
                fontWeight: 900,
                letterSpacing: { xs: '0.06em', md: '0.12em' },
                lineHeight: 1,
                whiteSpace: 'nowrap',
                animation: mounted ? `${scaleIn} 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both` : 'none',
                color: '#fff',
                textShadow: `0 2px 40px ${alpha(green, 0.4)}`
              }}
            >
              <Box component="span" sx={{ color: '#fff' }}>MAINT</Box>
              <Box
                component="span"
                sx={{
                  color: green,
                  display: 'inline',
                  animation: mounted ? `${softGlow} 4s ease-in-out infinite 0.5s` : 'none'
                }}
              >
                X
              </Box>
            </Typography>

            {/* Sous-titre + phrase d’accroche */}
            <Typography
              variant="h2"
              sx={{
                mt: 1.5,
                fontSize: { xs: '1rem', sm: '1.25rem', md: '1.4rem' },
                fontWeight: 600,
                letterSpacing: '0.02em',
                color: alpha('#fff', 0.95),
                animation: mounted ? `${fadeUp} 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both` : 'none'
              }}
            >
              {t('landing.subtitle')}
            </Typography>
            <Typography
              sx={{
                mt: 1.5,
                maxWidth: 520,
                mx: 'auto',
                fontSize: { xs: '0.9rem', md: '1rem' },
                lineHeight: 1.65,
                color: alpha('#fff', 0.78),
                animation: mounted ? `${fadeUp} 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both` : 'none'
              }}
            >
              {t('landing.lead')}
            </Typography>

            {/* Pills valeur : équipements, OT, stock, préventif */}
            <Stack
              direction="row"
              flexWrap="wrap"
              justifyContent="center"
              spacing={1.5}
              sx={{
                mt: 3,
                mb: 3,
                animation: mounted ? `${fadeUp} 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both` : 'none'
              }}
            >
              {[
                { icon: Build, key: 'feature1Title' },
                { icon: Assignment, key: 'feature2Title' },
                { icon: Inventory, key: 'feature3Title' },
                { icon: Schedule, key: 'feature4Title' }
              ].map(({ icon: Icon, key }) => (
                <Box
                  key={key}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 2,
                    bgcolor: alpha('#fff', 0.06),
                    border: `1px solid ${alpha(green, 0.2)}`,
                    color: alpha('#fff', 0.9),
                    fontSize: '0.8rem',
                    fontWeight: 500
                  }}
                >
                  <Icon sx={{ fontSize: 18, color: green }} />
                  {t(`landing.${key}`)}
                </Box>
              ))}
            </Stack>

            {/* CTAs */}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              justifyContent="center"
              sx={{ animation: mounted ? `${fadeUp} 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both` : 'none' }}
            >
              <Button
                size="large"
                variant="contained"
                startIcon={<Login />}
                onClick={() => navigate('/login')}
                sx={{
                  px: 4,
                  py: 1.6,
                  borderRadius: 2,
                  fontWeight: 600,
                  backgroundColor: green,
                  boxShadow: `0 16px 48px ${alpha(green, 0.4)}`,
                  transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: `0 24px 56px ${alpha(green, 0.5)}`
                  }
                }}
              >
                {t('landing.ctaLogin')}
              </Button>
              <Button
                size="large"
                variant="outlined"
                endIcon={<ArrowForward />}
                onClick={() => setFlipped(true)}
                sx={{
                  px: 4,
                  py: 1.6,
                  borderRadius: 2,
                  borderColor: alpha(green, 0.7),
                  color: green,
                  '&:hover': {
                    borderColor: green,
                    backgroundColor: alpha(green, 0.08),
                    transform: 'translateY(-3px)'
                  },
                  transition: 'all 0.25s ease'
                }}
              >
                {t('landing.ctaDiscover')}
              </Button>
            </Stack>
          </Box>

          {/* Face arrière : section offres — entrée animée */}
          <Box
            role="region"
            aria-label={t('landing.flipTitle')}
            sx={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              display: 'flex',
              flexDirection: 'column',
              bgcolor: alpha('#0a0e12', 0.98),
              borderRadius: 3,
              border: `1px solid ${alpha(green, 0.2)}`,
              boxShadow: `0 32px 64px ${alpha('#000', 0.5)}`,
              p: { xs: 1.5, sm: 2 },
              overflow: 'hidden',
              gap: 0
            }}
          >
            <Box key={flipped} sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
              {/* Lueur de passage (shine) */}
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  background: `linear-gradient(105deg, transparent 0%, ${alpha(green, 0.12)} 45%, transparent 55%)`,
                  animation: `${offersShine} 1.2s ease-out 0.4s both`,
                  zIndex: 0
                }}
              />
              {/* Barre titre + Retour */}
              <Box
                sx={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 1.5,
                  position: 'relative',
                  zIndex: 1,
                  animation: `${offersReveal} 0.65s cubic-bezier(0.34, 1.2, 0.64, 1) 0.05s both`
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 32, height: 3, borderRadius: 2, bgcolor: green }} />
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>{t('landing.flipTitle')}</Typography>
                </Box>
                <Button size="small" startIcon={<ArrowBack />} onClick={() => setFlipped(false)} sx={{ color: green, borderColor: alpha(green, 0.5), '&:hover': { borderColor: green, bgcolor: alpha(green, 0.08) } }} variant="outlined">
                  {t('landing.flipBack')}
                </Button>
              </Box>

              {/* Bloc description */}
              <Box
                sx={{
                  flexShrink: 0,
                  mb: 2,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: alpha(green, 0.06),
                  border: `1px solid ${alpha(green, 0.18)}`,
                  position: 'relative',
                  zIndex: 1,
                  animation: `${offersReveal} 0.6s cubic-bezier(0.34, 1.2, 0.64, 1) 0.15s both`
                }}
              >
                <Typography sx={{ color: '#fff', fontSize: '0.95rem', lineHeight: 1.6, fontWeight: 500 }}>
                  {t('landing.flipDescription')}
                </Typography>
              </Box>

              {/* Contenu principal : Forfaits */}
              <Grid container spacing={2} sx={{ flex: 1, minHeight: 0, position: 'relative', zIndex: 1 }}>
                <Grid item xs={12} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800, mb: 0.5, px: 0.5, letterSpacing: '-0.02em', animation: `${offersReveal} 0.55s cubic-bezier(0.34, 1.2, 0.64, 1) 0.22s both` }}>{t('landing.plansTitle')}</Typography>
                  <Typography variant="body2" sx={{ color: alpha('#fff', 0.78), display: 'block', mb: 2, px: 0.5, maxWidth: 640, lineHeight: 1.5, animation: `${offersReveal} 0.5s cubic-bezier(0.34, 1.2, 0.64, 1) 0.28s both` }}>{t('landing.plansSubtitle')}</Typography>
                  <Grid container spacing={2} sx={{ flex: 1, minHeight: 0, alignContent: 'flex-start' }}>
                    {[
                    { code: 'starter', nameKey: 'plan1Name', descKey: 'plan1Desc', priceKey: 'plan1Price', periodKey: 'plan1Period', features: ['plan1Feature1', 'plan1Feature2', 'plan1Feature3', 'plan1Feature4', 'plan1Feature5', 'plan1Feature6'], highlighted: false },
                    { code: 'pro', nameKey: 'plan2Name', descKey: 'plan2Desc', priceKey: 'plan2Price', periodKey: 'plan2Period', features: ['plan2Feature1', 'plan2Feature2', 'plan2Feature3', 'plan2Feature4', 'plan2Feature5', 'plan2Feature6'], highlighted: true },
                    { code: 'enterprise', nameKey: 'plan3Name', descKey: 'plan3Desc', priceKey: 'plan3Price', periodKey: 'plan3Period', features: ['plan3Feature1', 'plan3Feature2', 'plan3Feature3', 'plan3Feature4', 'plan3Feature5'], highlighted: false }
                  ].map((plan, cardIndex) => {
                    const offer = offers.find((o) => o.code === plan.code);
                    const hasPeriod = t(`landing.${plan.periodKey}`);
                    const priceText = offer != null
                      ? (offer.price != null ? (hasPeriod ? `${offer.price}` : `${offer.price} €`) : t('landing.plan3Price'))
                      : t(`landing.${plan.priceKey}`);
                    const cardDelay = 0.35 + cardIndex * 0.14;
                    return (
                      <Grid item xs={12} md={4} key={plan.nameKey} sx={{ display: 'flex', minHeight: 0 }}>
                        <Card
                          elevation={0}
                          sx={{
                            flex: 1,
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: 3,
                            overflow: 'visible',
                            animation: `${offersCardStagger} 0.7s cubic-bezier(0.34, 1.2, 0.64, 1) ${cardDelay}s both`,
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            ...(plan.highlighted
                              ? { background: `linear-gradient(180deg, ${alpha(green, 0.18)} 0%, ${alpha('#0d1218', 0.98)} 35%)` }
                              : { bgcolor: alpha('#0d1218', 0.98) }),
                            border: `2px solid ${plan.highlighted ? green : alpha(green, 0.22)}`,
                            boxShadow: plan.highlighted
                              ? `0 12px 40px ${alpha(green, 0.15)}, 0 0 0 1px ${alpha(green, 0.1)}`
                              : `0 6px 24px ${alpha('#000', 0.25)}`,
                            '&:hover': {
                              borderColor: plan.highlighted ? green : alpha(green, 0.5),
                              boxShadow: plan.highlighted
                                ? `0 16px 48px ${alpha(green, 0.2)}, 0 0 0 1px ${alpha(green, 0.15)}`
                                : `0 12px 32px ${alpha(green, 0.12)}`,
                              transform: 'translateY(-4px)'
                            }
                          }}
                        >
                          {plan.highlighted && (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: -12,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                px: 2,
                                py: 0.5,
                                borderRadius: 2,
                                bgcolor: green,
                                color: '#fff',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                boxShadow: `0 4px 12px ${alpha(green, 0.45)}`
                              }}
                            >
                              {t('landing.planPopular')}
                            </Box>
                          )}
                          <CardContent sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column', '&:last-child': { pb: 2.5 } }}>
                            <Typography variant="h6" sx={{ color: plan.highlighted ? green : '#fff', fontWeight: 800, fontSize: '1.25rem', mb: 0.5, letterSpacing: '-0.02em' }}>
                              {t(`landing.${plan.nameKey}`)}
                            </Typography>
                            {plan.descKey && t(`landing.${plan.descKey}`) && (
                              <Typography variant="body2" sx={{ color: alpha('#fff', 0.7), fontSize: '0.8rem', lineHeight: 1.45, mb: 1.5 }}>
                                {t(`landing.${plan.descKey}`)}
                              </Typography>
                            )}
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'baseline',
                                gap: 0.5,
                                mb: 2,
                                py: 1.25,
                                px: 1.5,
                                borderRadius: 2,
                                bgcolor: alpha(green, 0.08),
                                border: `1px solid ${alpha(green, 0.2)}`
                              }}
                            >
                              <Typography component="span" sx={{ color: green, fontWeight: 900, fontSize: '1.85rem', lineHeight: 1, letterSpacing: '-0.03em' }}>
                                {priceText}
                              </Typography>
                              {hasPeriod && (
                                <Typography component="span" sx={{ color: alpha('#fff', 0.65), fontSize: '0.8rem', fontWeight: 500 }}>
                                  {t(`landing.${plan.periodKey}`)}
                                </Typography>
                              )}
                            </Box>
                            <Typography variant="caption" sx={{ color: alpha('#fff', 0.55), textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, mb: 1 }}>
                              {t('landing.planFeaturesLabel')}
                            </Typography>
                            <Stack spacing={0.85} sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                              {plan.features.map((fk) => (
                                <Box key={fk} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                  <CheckCircle sx={{ fontSize: 20, color: green, flexShrink: 0, mt: 0.1 }} />
                                  <Typography sx={{ color: alpha('#fff', 0.92), fontSize: '0.825rem', lineHeight: 1.45, fontWeight: 500 }}>
                                    {t(`landing.${fk}`)}
                                  </Typography>
                                </Box>
                              ))}
                            </Stack>
                            <Button
                              type="button"
                              fullWidth
                              variant={plan.highlighted ? 'contained' : 'outlined'}
                              size="medium"
                              onClick={() => setDemoDialogOpen(true)}
                              sx={{
                                mt: 2,
                                py: 1.35,
                                borderRadius: 2,
                                fontSize: '0.9rem',
                                fontWeight: 700,
                                textTransform: 'none',
                                borderWidth: 2,
                                borderColor: green,
                                color: plan.highlighted ? '#fff' : green,
                                bgcolor: plan.highlighted ? green : 'transparent',
                                boxShadow: plan.highlighted ? `0 4px 14px ${alpha(green, 0.35)}` : 'none',
                                '&:hover': {
                                  borderWidth: 2,
                                  borderColor: green,
                                  bgcolor: plan.highlighted ? theme.palette.primary.dark : alpha(green, 0.12),
                                  boxShadow: plan.highlighted ? `0 6px 20px ${alpha(green, 0.4)}` : 'none'
                                }
                              }}
                            >
                              {t('landing.planCta')}
                            </Button>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
                  </Grid>
                </Grid>
              </Box>
            </Box>

          <Box sx={{ display: 'none' }} aria-hidden="true">
                <Button
                  size="large"
                  variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => setFlipped(false)}
              aria-label={t('landing.flipBack')}
                  sx={{
                alignSelf: 'center',
                px: 3,
                py: 1.4,
                    borderRadius: 2,
                borderColor: alpha(green, 0.7),
                color: green,
                    '&:hover': {
                  borderColor: green,
                  backgroundColor: alpha(green, 0.12),
                  transform: 'translateY(-2px)'
                },
                transition: 'all 0.25s ease'
              }}
            >
              {t('landing.flipBack')}
                </Button>
          </Box>
                </Box>
              </Box>

      {/* Dialog demande de démo — même animation que la section offres */}
      <Dialog
        open={demoDialogOpen}
        onClose={() => !demoSubmitting && setDemoDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            boxShadow: `0 24px 64px ${alpha('#000', 0.4)}`,
            animation: `${offersReveal} 0.5s cubic-bezier(0.34, 1.2, 0.64, 1) both`
          }
        }}
        TransitionProps={{ timeout: 400 }}
      >
        <Box key={demoDialogOpen ? 'demo-open' : 'demo-closed'} sx={{ position: 'relative', overflow: 'hidden' }}>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: `linear-gradient(105deg, transparent 0%, ${alpha(green, 0.08)} 45%, transparent 55%)`,
              animation: `${offersShine} 1s ease-out 0.25s both`,
              zIndex: 0
            }}
          />
          <DialogTitle
            sx={{
              borderBottom: '1px solid',
              borderColor: 'divider',
              pb: 1.5,
              position: 'relative',
              zIndex: 1,
              animation: `${offersReveal} 0.5s cubic-bezier(0.34, 1.2, 0.64, 1) 0.05s both`
            }}
          >
            {t('landing.demoFormTitle')}
          </DialogTitle>
          <form onSubmit={handleDemoSubmit}>
            <DialogContent sx={{ pt: 2, position: 'relative', zIndex: 1 }}>
              {demoSuccess ? (
                <Typography color="primary" fontWeight={600} sx={{ animation: `${offersReveal} 0.5s cubic-bezier(0.34, 1.2, 0.64, 1) 0.05s both` }}>{t('landing.demoSuccess')}</Typography>
              ) : (
                <Stack spacing={2}>
                  {demoError && (
                    <Typography variant="body2" color="error" sx={{ animation: `${offersReveal} 0.4s cubic-bezier(0.34, 1.2, 0.64, 1) 0.02s both` }}>{demoError}</Typography>
                  )}
                  <Box sx={{ animation: `${offersCardStagger} 0.5s cubic-bezier(0.34, 1.2, 0.64, 1) 0.08s both` }}>
                    <TextField required label={t('landing.demoFirstName')} value={demoForm.firstName} onChange={(e) => setDemoForm((f) => ({ ...f, firstName: e.target.value }))} fullWidth size="small" autoComplete="given-name" />
                  </Box>
                  <Box sx={{ animation: `${offersCardStagger} 0.5s cubic-bezier(0.34, 1.2, 0.64, 1) 0.12s both` }}>
                    <TextField required label={t('landing.demoLastName')} value={demoForm.lastName} onChange={(e) => setDemoForm((f) => ({ ...f, lastName: e.target.value }))} fullWidth size="small" autoComplete="family-name" />
                  </Box>
                  <Box sx={{ animation: `${offersCardStagger} 0.5s cubic-bezier(0.34, 1.2, 0.64, 1) 0.16s both` }}>
                    <TextField required type="email" label={t('landing.demoEmail')} value={demoForm.email} onChange={(e) => setDemoForm((f) => ({ ...f, email: e.target.value }))} fullWidth size="small" autoComplete="email" />
                  </Box>
                  <Box sx={{ animation: `${offersCardStagger} 0.5s cubic-bezier(0.34, 1.2, 0.64, 1) 0.2s both` }}>
                    <TextField label={t('landing.demoCompany')} value={demoForm.company} onChange={(e) => setDemoForm((f) => ({ ...f, company: e.target.value }))} fullWidth size="small" autoComplete="organization" />
                  </Box>
                  <Box sx={{ animation: `${offersCardStagger} 0.5s cubic-bezier(0.34, 1.2, 0.64, 1) 0.24s both` }}>
                    <TextField label={t('landing.demoPhone')} value={demoForm.phone} onChange={(e) => setDemoForm((f) => ({ ...f, phone: e.target.value }))} fullWidth size="small" autoComplete="tel" />
                  </Box>
                  <Box sx={{ animation: `${offersCardStagger} 0.5s cubic-bezier(0.34, 1.2, 0.64, 1) 0.28s both` }}>
                    <TextField label={t('landing.demoMessage')} value={demoForm.message} onChange={(e) => setDemoForm((f) => ({ ...f, message: e.target.value }))} fullWidth size="small" multiline rows={3} />
                  </Box>
                </Stack>
              )}
            </DialogContent>
            {!demoSuccess && (
              <DialogActions
                sx={{
                  px: 3,
                  pb: 2,
                  pt: 0,
                  position: 'relative',
                  zIndex: 1,
                  animation: `${offersReveal} 0.45s cubic-bezier(0.34, 1.2, 0.64, 1) 0.32s both`
                }}
              >
                <Button onClick={() => setDemoDialogOpen(false)} disabled={demoSubmitting}>{t('landing.demoCancel')}</Button>
                <Button type="submit" variant="contained" disabled={demoSubmitting}>{demoSubmitting ? t('landing.demoSending') : t('landing.demoSubmit')}</Button>
              </DialogActions>
            )}
          </form>
        </Box>
      </Dialog>

      {/* Footer : © 2026 MAINTX + email */}
      <Box
        id="footer"
        component="footer"
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          py: 2,
          textAlign: 'center',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5
        }}
      >
        <Typography variant="caption" sx={{ color: alpha('#fff', 0.5) }}>
          © 2026 MAINTX. {t('landing.footerRights')}
        </Typography>
        <Box component="a" href={`mailto:${CONTACT_EMAIL}`} sx={{ color: alpha('#fff', 0.6), fontSize: '0.8rem', textDecoration: 'none', '&:hover': { color: green, textDecoration: 'underline' } }}>
          {CONTACT_EMAIL}
        </Box>
      </Box>
    </Box>
  );
}
