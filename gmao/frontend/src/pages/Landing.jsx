import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Stack, Grid, Card, CardContent } from '@mui/material';
import { useTheme, alpha, keyframes } from '@mui/material/styles';
import { Login, ArrowForward, ArrowBack, Build, Assignment, Inventory, Schedule, List, Email, ContactMail } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1920&q=85&auto=format&fit=crop';
const CONTACT_EMAIL = 'contact@maintx.org';

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

export default function Landing() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const green = theme.palette.primary.main;
  const [mounted, setMounted] = useState(false);
  const [flipped, setFlipped] = useState(false);

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
          perspective: '1200px',
          px: 2
                  }}
                >
                  <Box
                    sx={{
            position: 'relative',
            width: '100%',
            maxWidth: 920,
            height: 'min(92vh, 720px)',
            minHeight: 480,
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 0.75s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {/* Face avant : MAINTX + CTAs */}
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
              textAlign: 'center'
            }}
          >
                <Typography
              component="h1"
                  sx={{
                fontSize: { xs: '4.5rem', sm: '8rem', md: '12rem', lg: '14rem' },
                fontWeight: 900,
                letterSpacing: { xs: '0.06em', md: '0.12em' },
                lineHeight: 1,
                whiteSpace: 'nowrap',
                animation: mounted ? `${scaleIn} 0.9s cubic-bezier(0.16, 1, 0.3, 1) both` : 'none',
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
                  <Typography
                    sx={{
                mt: 2,
                mb: 4,
                fontSize: { xs: '0.85rem', md: '1.1rem' },
                letterSpacing: '0.28em',
                color: alpha('#fff', 0.85),
                animation: mounted ? `${fadeUp} 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both` : 'none'
              }}
            >
              {t('landing.tagline')}
                  </Typography>
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

          {/* Face arrière : description — occupe tout l'espace */}
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
              bgcolor: alpha('#0a0e12', 0.97),
              borderRadius: 3,
              border: `1px solid ${alpha(green, 0.25)}`,
              boxShadow: `0 24px 80px ${alpha('#000', 0.5)}, 0 0 0 1px ${alpha(green, 0.08)}`,
              p: { xs: 2, sm: 2.5 },
              overflow: 'hidden',
              gap: 0
            }}
          >
            <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{ width: 40, height: 3, borderRadius: 2, bgcolor: green, opacity: 0.9 }} />
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
                {t('landing.flipTitle')}
                      </Typography>
      </Box>

            <Grid container spacing={1.5} sx={{ flex: 1, minHeight: 0, alignContent: 'stretch' }}>
              {/* Colonne gauche : À propos + En détail — remplissent la hauteur */}
              <Grid item xs={12} md={5} sx={{ display: 'flex', minHeight: 0 }}>
                <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0, width: '100%' }}>
                  <Card sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: alpha(green, 0.06), border: `1px solid ${alpha(green, 0.2)}`, borderRadius: 1.5 }}>
                    <CardContent sx={{ p: 1.5, flex: 1, display: 'flex', flexDirection: 'column', '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="subtitle2" sx={{ color: green, fontWeight: 600, mb: 0.5 }}>
                        {t('landing.flipAboutTitle')}
                  </Typography>
                      <Typography sx={{ color: alpha('#fff', 0.88), fontSize: '0.8rem', lineHeight: 1.5, flex: 1 }}>
                        {t('landing.flipAboutText')}
                  </Typography>
                    </CardContent>
                  </Card>
                  <Card sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: alpha('#0d1218', 0.6), border: `1px solid ${alpha(green, 0.18)}`, borderRadius: 1.5 }}>
                    <CardContent sx={{ p: 1.5, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, flexShrink: 0 }}>
                        <List sx={{ fontSize: 16, color: green }} />
                        <Typography variant="subtitle2" sx={{ color: green, fontWeight: 600, fontSize: '0.8rem' }}>
                          {t('landing.flipDetailTitle')}
                            </Typography>
                          </Box>
                      <Stack component="ul" spacing={0.25} sx={{ m: 0, pl: 2, listStyleType: 'disc', flex: 1, '& li': { color: alpha('#fff', 0.82), fontSize: '0.75rem', lineHeight: 1.4 } }}>
                        <Typography component="li">{t('landing.flipDetail1')}</Typography>
                        <Typography component="li">{t('landing.flipDetail2')}</Typography>
                        <Typography component="li">{t('landing.flipDetail3')}</Typography>
                        <Typography component="li">{t('landing.flipDetail4')}</Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Stack>
                  </Grid>

              {/* Colonne droite : 4 features + Contact — remplissent la hauteur */}
              <Grid item xs={12} md={7} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <Grid container spacing={1.5} sx={{ flex: 1, minHeight: 0, alignContent: 'stretch' }}>
                  {[
                    { Icon: Build, titleKey: 'feature1Title', descKey: 'feature1Desc' },
                    { Icon: Assignment, titleKey: 'feature2Title', descKey: 'feature2Desc' },
                    { Icon: Inventory, titleKey: 'feature3Title', descKey: 'feature3Desc' },
                    { Icon: Schedule, titleKey: 'feature4Title', descKey: 'feature4Desc' }
                  ].map(({ Icon, titleKey, descKey }) => (
                    <Grid item xs={12} sm={6} key={titleKey} sx={{ display: 'flex', minHeight: 0 }}>
                      <Card sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: alpha('#0d1218', 0.8), border: `1px solid ${alpha(green, 0.15)}`, borderRadius: 1.5, '&:hover': { borderColor: alpha(green, 0.3) } }}>
                        <CardContent sx={{ p: 1.5, flex: 1, display: 'flex', flexDirection: 'column', '&:last-child': { pb: 1.5 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flex: 1 }}>
                            <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: alpha(green, 0.15), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Icon sx={{ fontSize: 18, color: green }} />
                </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.8rem' }}>{t(`landing.${titleKey}`)}</Typography>
                              <Typography variant="body2" sx={{ color: alpha('#fff', 0.75), fontSize: '0.75rem', lineHeight: 1.4 }}>{t(`landing.${descKey}`)}</Typography>
              </Box>
                          </Box>
                        </CardContent>
                      </Card>
            </Grid>
                  ))}
          </Grid>
                <Card sx={{ flexShrink: 0, mt: 1.5, bgcolor: alpha(green, 0.06), border: `1px solid ${alpha(green, 0.25)}`, borderRadius: 1.5 }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
                      <ContactMail sx={{ fontSize: 18, color: green }} />
                      <Typography variant="subtitle2" sx={{ color: green, fontWeight: 600, fontSize: '0.8rem' }}>{t('landing.flipContactTitle')}</Typography>
                      <Typography sx={{ color: alpha('#fff', 0.85), fontSize: '0.8rem' }}>{t('landing.flipContactText')}</Typography>
                      <Box component="a" href={`mailto:${CONTACT_EMAIL}`} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: green, fontSize: '0.8rem', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                        <Email sx={{ fontSize: 16 }} />
                        {t('landing.flipContactEmail')}
      </Box>
                      <Button component="a" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t('landing.flipContactDemo'))}`} variant="contained" size="small" sx={{ bgcolor: green, '&:hover': { bgcolor: theme.palette.primary.dark }, fontSize: '0.75rem', py: 0.5, px: 1.5 }}>
                        {t('landing.flipContactDemo')}
                      </Button>
            </Box>
                      </CardContent>
                    </Card>
                </Grid>
          </Grid>

            <Box sx={{ flexShrink: 0, pt: 1.5, display: 'flex', justifyContent: 'center' }}>
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
      </Box>

      {/* Footer minimal */}
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
          zIndex: 1
        }}
      >
        <Typography variant="caption" sx={{ color: alpha('#fff', 0.45) }}>
          © {new Date().getFullYear()} MAINTX. {t('landing.footerRights')}
            </Typography>
      </Box>
    </Box>
  );
}
