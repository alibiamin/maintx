import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  alpha,
  useTheme
} from '@mui/material';
import {
  Build,
  Assignment,
  Inventory,
  Assessment,
  Schedule,
  Security,
  Login,
  ArrowForward,
  KeyboardDoubleArrowDown,
  CheckCircle
} from '@mui/icons-material';
import { THEME_COLORS } from '../theme';

// Images thématiques (Unsplash - libres d'utilisation)
const HERO_IMAGE = 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1200&q=80';
const ABOUT_IMAGE = 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80';

const features = [
  {
    icon: Build,
    title: 'Gestion des équipements',
    description: 'Parc machine, hiérarchie sites / lignes, fiches techniques, historique et documents.',
    longDescription: 'Centralisez l\'ensemble de votre parc : arborescence sites et lignes, fiches techniques détaillées, historique des interventions et documents associés. Visualisez l\'état de chaque équipement en un coup d\'œil.',
    image: 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=600&q=80'
  },
  {
    icon: Assignment,
    title: 'Ordres de travail',
    description: 'Déclaration, planification, affectation et suivi des interventions.',
    longDescription: 'Créez et suivez vos OT de la déclaration à la clôture : planification, affectation aux techniciens, suivi en temps réel et historique complet. Réduisez les délais d\'intervention et améliorez la réactivité.',
    image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=600&q=80'
  },
  {
    icon: Inventory,
    title: 'Stock & pièces',
    description: 'Nomenclatures, mouvements, alertes de seuil et réapprovisionnements.',
    longDescription: 'Pilotez vos pièces détachées et consommables : nomenclatures liées aux équipements, mouvements d\'entrée/sortie, alertes de seuil et bons de réapprovisionnement. Évitez les ruptures et optimisez les coûts.',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&q=80'
  },
  {
    icon: Schedule,
    title: 'Maintenance préventive',
    description: 'Plans de maintenance, échéances, checklists et procédures.',
    longDescription: 'Automatisez la maintenance préventive : plans par équipement, échéances et rappels, checklists d’intervention et procédures standardisées. Limitez les pannes et prolongez la durée de vie des actifs.',
    image: 'https://images.unsplash.com/photo-1581092918484-8313e1f7f5c5?w=600&q=80'
  },
  {
    icon: Assessment,
    title: 'Rapports & indicateurs',
    description: 'KPIs, coûts, MTTR, disponibilité et exports Excel / PDF.',
    longDescription: 'Pilotez la performance avec des tableaux de bord et rapports : KPIs (MTTR, MTBF, disponibilité), analyse des coûts, exports Excel et PDF. Prenez des décisions basées sur des données fiables.',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80'
  },
  {
    icon: Security,
    title: 'Sécurité & traçabilité',
    description: 'Rôles, droits d\'accès, audit et alertes configurables.',
    longDescription: 'Sécurisez l’accès et tracez toutes les actions : rôles et droits granulaires, journal d’audit, alertes configurables. Conformité et maîtrise des processus garanties.',
    image: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=600&q=80'
  }
];

const highlights = [
  'Parc équipements centralisé',
  'Ordres de travail en temps réel',
  'Maintenance préventive planifiée',
  'Rapports et indicateurs à la demande'
];

const keyframes = {
  '@keyframes heroTitleIn': {
    '0%': { opacity: 0, transform: 'translateY(24px)' },
    '100%': { opacity: 1, transform: 'translateY(0)' }
  },
  '@keyframes heroSubIn': {
    '0%': { opacity: 0, transform: 'translateY(16px)' },
    '100%': { opacity: 1, transform: 'translateY(0)' }
  },
  '@keyframes heroCtaIn': {
    '0%': { opacity: 0, transform: 'translateY(12px)' },
    '100%': { opacity: 1, transform: 'translateY(0)' }
  },
  '@keyframes float': {
    '0%, 100%': { transform: 'translateY(0)' },
    '50%': { transform: 'translateY(-8px)' }
  },
  '@keyframes lineReveal': {
    '0%': { transform: 'scaleX(0)' },
    '100%': { transform: 'scaleX(1)' }
  },
  '@keyframes fadeInUp': {
    '0%': { opacity: 0, transform: 'translateY(24px)' },
    '100%': { opacity: 1, transform: 'translateY(0)' }
  },
  '@keyframes fadeIn': {
    '0%': { opacity: 0 },
    '100%': { opacity: 1 }
  }
};

export default function Landing() {
  const navigate = useNavigate();
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const primaryDark = theme.palette.primary.dark;

  const heroStyle = useMemo(() => ({
    ...keyframes,
    '& .maintx': { animation: 'heroTitleIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards' },
    '& .gmao': { animation: 'heroTitleIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.15s forwards', opacity: 0 },
    '& .tagline': { animation: 'heroSubIn 0.6s ease-out 0.35s forwards', opacity: 0 },
    '& .cta-wrap': { animation: 'heroCtaIn 0.5s ease-out 0.55s forwards', opacity: 0 }
  }), []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#ffffff', color: 'text.primary', position: 'relative' }}>
      {/* Hero — fond blanc + bande verte légère + image */}
      <Box
        sx={{
          position: 'relative',
          pt: { xs: 6, md: 10 },
          pb: { xs: 6, md: 8 },
          px: 2,
          background: `linear-gradient(180deg, ${alpha(primary, 0.04)} 0%, #ffffff 35%)`,
          overflow: 'hidden'
        }}
      >
        <Container maxWidth="lg" sx={heroStyle}>
          <Grid container alignItems="center" spacing={4}>
            <Grid item xs={12} md={6}>
              <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                <Typography
                  component="h1"
                  className="maintx"
                  sx={{
                    fontSize: { xs: '2.5rem', sm: '3.25rem', md: '3.75rem' },
                    fontWeight: 800,
                    letterSpacing: '-0.04em',
                    color: 'text.primary',
                    lineHeight: 1.1
                  }}
                >
                  MAINT<Box component="span" sx={{ color: primary }}>X</Box>
                </Typography>
                <Typography
                  component="span"
                  className="gmao"
                  sx={{
                    display: 'block',
                    fontSize: { xs: '1.75rem', sm: '2.25rem', md: '2.75rem' },
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    color: primary,
                    mt: 0.5,
                    borderBottom: `3px solid ${alpha(primary, 0.5)}`,
                    pb: 0.5
                  }}
                >
                  GMAO
                </Typography>
                <Typography
                  className="tagline"
                  variant="h6"
                  sx={{ color: 'text.secondary', mt: 2, mb: 1, fontWeight: 500 }}
                >
                  Gestion de la Maintenance Assistée par Ordinateur
                </Typography>
                <Typography className="tagline" variant="body1" sx={{ color: 'text.secondary', mb: 3, maxWidth: 420 }}>
                  Pilotez votre parc équipements, ordres de travail et maintenance préventive en un seul outil moderne et fiable.
                </Typography>
                <Box className="cta-wrap" sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: { xs: 'center', md: 'flex-start' } }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<Login />}
                    onClick={() => navigate('/login')}
                    sx={{
                      px: 3,
                      py: 1.5,
                      borderRadius: 2,
                      fontWeight: 700,
                      textTransform: 'none',
                      boxShadow: `0 4px 20px ${alpha(primary, 0.35)}`,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: `0 6px 28px ${alpha(primary, 0.45)}`
                      }
                    }}
                  >
                    Accéder à l'application
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    endIcon={<ArrowForward />}
                    onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                    sx={{
                      px: 3,
                      py: 1.5,
                      borderRadius: 2,
                      fontWeight: 600,
                      textTransform: 'none',
                      borderColor: alpha(primary, 0.6),
                      color: primary,
                      transition: 'all 0.3s ease',
                      '&:hover': { borderColor: primary, bgcolor: alpha(primary, 0.06), transform: 'translateY(-2px)' }
                    }}
                  >
                    Découvrir
                  </Button>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  borderRadius: 3,
                  overflow: 'hidden',
                  boxShadow: `0 24px 56px ${alpha(primary, 0.12)}`,
                  border: `1px solid ${alpha(primary, 0.1)}`,
                  animation: 'fadeInUp 0.8s ease-out 0.3s forwards',
                  opacity: 0
                }}
              >
                <Box
                  component="img"
                  src={HERO_IMAGE}
                  alt="Maintenance industrielle"
                  sx={{ width: '100%', height: { xs: 280, sm: 340 }, objectFit: 'cover' }}
                />
              </Box>
            </Grid>
          </Grid>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, animation: 'float 3s ease-in-out infinite' }}>
            <KeyboardDoubleArrowDown sx={{ color: alpha(primary, 0.7), fontSize: 28 }} />
          </Box>
        </Container>
      </Box>

      {/* Section À propos — image + texte (layout moderne alterné) */}
      <Box sx={{ py: { xs: 8, md: 10 }, px: 2, bgcolor: '#f8fafc' }}>
        <Container maxWidth="lg">
          <Grid container alignItems="center" spacing={6}>
            <Grid item xs={12} md={6} order={{ xs: 2, md: 1 }}>
              <Box
                sx={{
                  borderRadius: 3,
                  overflow: 'hidden',
                  boxShadow: 2,
                  animation: 'fadeInUp 0.6s ease-out forwards'
                }}
              >
                <Box
                  component="img"
                  src={ABOUT_IMAGE}
                  alt="Tableau de bord et indicateurs"
                  sx={{ width: '100%', height: 320, objectFit: 'cover' }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6} order={{ xs: 1, md: 2 }}>
              <Typography
                variant="overline"
                sx={{ color: primary, fontWeight: 700, letterSpacing: 0.2 }}
              >
                Notre solution
              </Typography>
              <Typography variant="h4" fontWeight={700} sx={{ mt: 1, mb: 2, color: 'text.primary' }}>
                Une GMAO complète pour industrialiser votre maintenance
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.7 }}>
                MaintX GMAO centralise équipements, ordres de travail, stocks et indicateurs dans une interface unique. 
                Réduisez les pannes, optimisez les coûts et gardez la maîtrise de votre parc avec des rapports et une traçabilité à chaque étape.
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {highlights.map((item, i) => (
                  <Box
                    component="li"
                    key={i}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 1,
                      color: 'text.secondary',
                      '& .icon': { color: primary, flexShrink: 0 }
                    }}
                  >
                    <CheckCircle className="icon" sx={{ fontSize: 20 }} />
                    <Typography variant="body2">{item}</Typography>
                  </Box>
                ))}
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Fonctionnalités — cartes avec image, description longue */}
      <Box id="features" sx={{ py: { xs: 8, md: 12 }, px: 2 }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="overline" sx={{ color: primary, fontWeight: 700, letterSpacing: 0.2 }}>
              Fonctionnalités
            </Typography>
            <Typography variant="h4" fontWeight={700} sx={{ mt: 1, mb: 2, color: 'text.primary' }}>
              Tout ce dont vous avez besoin pour piloter la maintenance
            </Typography>
            <Box
              sx={{
                width: 64,
                height: 4,
                mx: 'auto',
                borderRadius: 2,
                bgcolor: primary
              }}
            />
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560, mx: 'auto', mt: 2 }}>
              Modules intégrés pour équipements, OT, stock, préventif, rapports et sécurité.
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {features.map((feat, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Card
                  sx={{
                    height: '100%',
                    borderRadius: 3,
                    border: `1px solid ${alpha(primary, 0.12)}`,
                    overflow: 'hidden',
                    transition: 'all 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
                    animation: `fadeInUp 0.5s ease-out ${0.08 * i + 0.2}s forwards`,
                    opacity: 0,
                    '&:hover': {
                      transform: 'translateY(-6px)',
                      boxShadow: `0 20px 40px ${alpha(primary, 0.12)}`,
                      borderColor: alpha(primary, 0.25),
                      '& .card-media': { transform: 'scale(1.03)' },
                      '& .icon-wrap': { bgcolor: alpha(primary, 0.18) }
                    }
                  }}
                >
                  <CardMedia
                    className="card-media"
                    component="img"
                    height="160"
                    image={feat.image}
                    alt={feat.title}
                    sx={{
                      objectFit: 'cover',
                      transition: 'transform 0.4s ease'
                    }}
                  />
                  <CardContent sx={{ p: 2.5 }}>
                    <Box
                      className="icon-wrap"
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        bgcolor: alpha(primary, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: primary,
                        mb: 1.5,
                        transition: 'background-color 0.3s ease'
                      }}
                    >
                      <feat.icon sx={{ fontSize: 26 }} />
                    </Box>
                    <Typography variant="h6" fontWeight={700} sx={{ color: 'text.primary', mb: 1 }}>
                      {feat.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                      {feat.longDescription}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA final — fond vert très léger */}
      <Box
        sx={{
          py: 8,
          px: 2,
          background: `linear-gradient(135deg, ${alpha(primary, 0.08)} 0%, ${alpha(primary, 0.04)} 100%)`,
          borderTop: `1px solid ${alpha(primary, 0.1)}`
        }}
      >
        <Container maxWidth="md">
          <Box
            sx={{
              textAlign: 'center',
              p: 4,
              borderRadius: 3,
              bgcolor: '#ffffff',
              boxShadow: `0 8px 32px ${alpha(primary, 0.08)}`,
              border: `1px solid ${alpha(primary, 0.12)}`
            }}
          >
            <Typography variant="h5" fontWeight={700} sx={{ color: 'text.primary', mb: 1 }}>
              Prêt à gérer votre maintenance ?
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Connectez-vous pour accéder au tableau de bord, aux ordres de travail et à l'ensemble des modules.
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={<Login />}
              onClick={() => navigate('/login')}
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 2,
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: `0 4px 20px ${alpha(primary, 0.35)}`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: `0 6px 28px ${alpha(primary, 0.45)}`
                }
              }}
            >
              Se connecter
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 3,
          px: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          textAlign: 'center',
          bgcolor: '#ffffff'
        }}
      >
        <Typography variant="body2" color="text.secondary">
          <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>MaintX</Box>
          <Box component="span" sx={{ color: primary, fontWeight: 700, mx: 0.5 }}> GMAO</Box>
          — Gestion de la Maintenance Assistée par Ordinateur
        </Typography>
      </Box>

      {/* Injection keyframes pour animations */}
      <Box sx={keyframes} />
    </Box>
  );
}
