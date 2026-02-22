import React, { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  alpha,
  useTheme,
  Paper,
  Avatar,
  Chip,
  Stack,
  Divider,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
  CheckCircle,
  Speed,
  TrendingUp,
  Engineering,
  Support,
  LocalShipping,
  Biotech,
  Analytics,
  CloudDone,
  EmojiEvents,
  TrendingDown,
  Timeline,
  PrecisionManufacturing
} from '@mui/icons-material';
import { THEME_COLORS } from '../theme';

// Images optimisées avec attributs de performance
const HERO_IMAGE = 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1200&q=80&auto=format&fit=crop';
const ABOUT_IMAGE = 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80&auto=format&fit=crop';

// Données enrichies
const features = [
  {
    icon: PrecisionManufacturing,
    title: 'Gestion des équipements',
    description: 'Parc machine, hiérarchie sites / lignes, fiches techniques, historique et documents.',
    longDescription: 'Centralisez l\'ensemble de votre parc avec une arborescence intuitive. Suivez le cycle de vie complet de vos équipements avec fiches techniques, historique des interventions et documents associés.',
    image: 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=600&q=80&auto=format&fit=crop',
    stats: '+40% de visibilité',
    benefits: ['Arborescence flexible', 'Historique complet', 'Documents centralisés']
  },
  {
    icon: Assignment,
    title: 'Ordres de travail',
    description: 'Déclaration, planification, affectation et suivi des interventions.',
    longDescription: 'Créez et suivez vos OT de la déclaration à la clôture avec un workflow optimisé. Planification intelligente, affectation aux techniciens et suivi en temps réel.',
    image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=600&q=80&auto=format&fit=crop',
    stats: '-35% de délais',
    benefits: ['Workflow personnalisable', 'Affectation automatique', 'Notifications temps réel']
  },
  {
    icon: Inventory,
    title: 'Stock & pièces',
    description: 'Nomenclatures, mouvements, alertes de seuil et réapprovisionnements.',
    longDescription: 'Pilotez vos pièces détachées avec précision : nomenclatures techniques, gestion des mouvements, alertes automatiques de seuil et génération de bons de réapprovisionnement.',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&q=80&auto=format&fit=crop',
    stats: '-50% de ruptures',
    benefits: ['Alertes seuils', 'Nomenclatures techniques', 'Réappro automatique']
  },
  {
    icon: Schedule,
    title: 'Maintenance préventive',
    description: 'Plans de maintenance, échéances, checklists et procédures.',
    longDescription: 'Automatisez votre maintenance préventive avec des plans personnalisés, des échéances automatiques et des checklists d\'intervention standardisées.',
    image: 'https://images.unsplash.com/photo-1581093458791-9f4146a73817?w=600&q=80&auto=format&fit=crop',
    stats: '+60% de durée de vie',
    benefits: ['Plans automatisés', 'Checklists standard', 'Rappels intelligents']
  },
  {
    icon: Timeline,
    title: 'Rapports & indicateurs',
    description: 'KPIs, coûts, MTTR, disponibilité et exports Excel / PDF.',
    longDescription: 'Pilotez la performance avec des tableaux de bord interactifs et des rapports personnalisables. Analysez les coûts, suivez le MTTR/MTBF et exportez vos données.',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80&auto=format&fit=crop',
    stats: 'KPIs en temps réel',
    benefits: ['Tableaux de bord', 'Exports multi-formats', 'Analyses prédictives']
  },
  {
    icon: Security,
    title: 'Sécurité & traçabilité',
    description: 'Rôles, droits d\'accès, audit et alertes configurables.',
    longDescription: 'Sécurisez vos données avec une gestion fine des droits d\'accès, un journal d\'audit complet et des alertes configurables pour une conformité totale.',
    image: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=600&q=80&auto=format&fit=crop',
    stats: 'Audit complet',
    benefits: ['Rôles personnalisés', 'Traçabilité totale', 'Alertes configurables']
  }
];

const stats = [
  { icon: Speed, value: '+45%', label: 'Productivité', color: '#4CAF50' },
  { icon: TrendingDown, value: '-30%', label: 'Coûts maintenance', color: '#2196F3' },
  { icon: Timeline, value: '99.9%', label: 'Disponibilité', color: '#9C27B0' }
];

const faqItems = [
  {
    question: 'Qu\'est-ce que MaintX GMAO ?',
    answer: 'MaintX GMAO est une solution de Gestion de Maintenance Assistée par Ordinateur qui centralise équipements, ordres de travail, stock, maintenance préventive et rapports dans une seule plateforme moderne.'
  },
  {
    question: 'Comment accéder à l\'application ?',
    answer: 'Cliquez sur « Accéder à l\'application » ou « Se connecter » puis saisissez vos identifiants. Si vous n\'avez pas encore de compte, contactez votre administrateur.'
  },
  {
    question: 'Quels secteurs peuvent utiliser MaintX ?',
    answer: 'Industrie manufacturière, agroalimentaire, énergie, BTP, transport, santé… Tout secteur ayant un parc d\'équipements à maintenir et à suivre.'
  },
  {
    question: 'Les données sont-elles sécurisées ?',
    answer: 'Oui. MaintX propose des rôles et droits d\'accès configurables, un journal d\'audit et des alertes. Vos données sont protégées et traçables.'
  }
];

const keyframes = {
  '@keyframes slideUp': {
    '0%': { opacity: 0, transform: 'translateY(30px)' },
    '100%': { opacity: 1, transform: 'translateY(0)' }
  },
  '@keyframes fadeScale': {
    '0%': { opacity: 0, transform: 'scale(0.95)' },
    '100%': { opacity: 1, transform: 'scale(1)' }
  },
  '@keyframes float': {
    '0%, 100%': { transform: 'translateY(0)' },
    '50%': { transform: 'translateY(-10px)' }
  },
  '@keyframes pulse': {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.7 }
  }
};

export default function Landing() {
  const navigate = useNavigate();
  const theme = useTheme();
  const primary = theme.palette.primary.main;

  const handleScroll = useCallback((id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const heroStyles = useMemo(() => ({
    ...keyframes,
    '& .hero-title': { animation: 'slideUp 0.8s ease-out forwards' },
    '& .hero-subtitle': { animation: 'slideUp 0.8s ease-out 0.2s forwards', opacity: 0 },
    '& .hero-description': { animation: 'slideUp 0.8s ease-out 0.4s forwards', opacity: 0 },
    '& .hero-cta': { animation: 'fadeScale 0.6s ease-out 0.6s forwards', opacity: 0 }
  }), []);

  return (
    <Box component="main" sx={{ minHeight: '100vh', overflowX: 'hidden' }}>
      {/* Lien d'évitement pour l'accessibilité */}
      <Box
        component="a"
        href="#contenu-principal"
        sx={{
          position: 'absolute',
          left: -9999,
          zIndex: 9999,
          p: 2,
          bgcolor: 'primary.main',
          color: 'white',
          fontWeight: 700,
          '&:focus': { left: 16, top: 16 }
        }}
      >
        Aller au contenu principal
      </Box>

      {/* Hero Section — image en fond de page */}
      <Box
        component="header"
        id="contenu-principal"
        aria-label="En-tête"
        sx={{
          position: 'relative',
          minHeight: '100vh',
          pt: { xs: 8, md: 12 },
          pb: { xs: 8, md: 10 },
          backgroundImage: `url(${HERO_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(105deg, ${alpha('#fff', 0.94)} 0%, ${alpha('#fff', 0.82)} 45%, ${alpha('#fff', 0.5)} 100%)`,
            pointerEvents: 'none'
          }
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, ...heroStyles }}>
          <Grid container alignItems="center" spacing={6}>
            <Grid item xs={12} md={8}>
              <Box>
                <Chip
                  label="GMAO nouvelle génération"
                  sx={{
                    mb: 3,
                    bgcolor: alpha(primary, 0.1),
                    color: primary,
                    fontWeight: 600,
                    animation: 'fadeScale 0.5s ease-out forwards'
                  }}
                />
                
                <Typography
                  variant="h1"
                  className="hero-title"
                  sx={{
                    fontSize: { xs: '4rem', sm: '5rem', md: '6rem' },
                    fontWeight: 800,
                    lineHeight: 1.1,
                    letterSpacing: '-0.03em',
                    mb: 2
                  }}
                >
                  MAINT
                  <Box component="span" sx={{ color: primary }}>X</Box>
                  <Typography
                    component="span"
                    variant="h2"
                    sx={{
                      display: 'block',
                      fontSize: { xs: '2.75rem', sm: '3.5rem', md: '4.25rem' },
                      fontWeight: 700,
                      color: primary,
                      mt: 1
                    }}
                  >
                    GMAO
                  </Typography>
                </Typography>

                <Typography
                  variant="h5"
                  className="hero-subtitle"
                  sx={{ color: 'text.secondary', fontWeight: 500, mb: 2 }}
                >
                  La solution complète pour votre maintenance industrielle
                </Typography>

                <Typography
                  variant="body1"
                  className="hero-description"
                  sx={{ color: 'text.secondary', mb: 4, maxWidth: 500, fontSize: '1.1rem' }}
                >
                  Centralisez, automatisez et optimisez votre maintenance avec une plateforme moderne et intuitive. 
                  Réduisez les pannes, maîtrisez vos coûts et augmentez la disponibilité de vos équipements.
                </Typography>

                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  className="hero-cta"
                  sx={{ mb: 4 }}
                >
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<Login />}
                    onClick={() => navigate('/login')}
                    sx={{
                      px: 4,
                      py: 1.8,
                      borderRadius: 2,
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      textTransform: 'none',
                      background: `linear-gradient(135deg, ${primary} 0%, ${theme.palette.primary.dark} 100%)`,
                      boxShadow: `0 10px 30px ${alpha(primary, 0.4)}`,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: `0 15px 35px ${alpha(primary, 0.5)}`
                      }
                    }}
                  >
                    Accéder à l'application
                  </Button>
                  
                  <Button
                    variant="outlined"
                    size="large"
                    endIcon={<ArrowForward />}
                    onClick={() => handleScroll('features')}
                    sx={{
                      px: 4,
                      py: 1.8,
                      borderRadius: 2,
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      textTransform: 'none',
                      borderColor: alpha(primary, 0.3),
                      borderWidth: 2,
                      color: primary,
                      '&:hover': {
                        borderColor: primary,
                        borderWidth: 2,
                        bgcolor: alpha(primary, 0.05)
                      }
                    }}
                  >
                    Découvrir les fonctionnalités
                  </Button>
                </Stack>

                {/* Stats */}
                <Stack direction="row" spacing={4} className="hero-cta">
                  {stats.map((stat, index) => (
                    <Box key={index} sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" sx={{ fontWeight: 800, color: stat.color }}>
                        {stat.value}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        {stat.label}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
            <IconButton
              onClick={() => handleScroll('about')}
              aria-label="Voir la section À propos"
              sx={{
                animation: 'pulse 2s ease-in-out infinite',
                color: primary,
                bgcolor: alpha(primary, 0.1),
                '&:hover': { bgcolor: alpha(primary, 0.2) }
              }}
            >
              <KeyboardDoubleArrowDown sx={{ fontSize: 32 }} />
            </IconButton>
          </Box>
        </Container>
      </Box>

      {/* About Section — image en fond */}
      <Box
        component="section"
        id="about"
        aria-labelledby="about-title"
        sx={{
          position: 'relative',
          py: { xs: 10, md: 14 },
          backgroundImage: `url(${ABOUT_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(90deg, ${alpha('#fff', 0.92)} 0%, ${alpha('#fff', 0.78)} 100%)`,
            pointerEvents: 'none'
          }
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Grid container alignItems="center" spacing={6}>
            <Grid item xs={12} md={8}>
              <Chip
                icon={<Biotech />}
                label="Innovation & Performance"
                sx={{ mb: 2, bgcolor: alpha(primary, 0.1), color: primary }}
              />
              
              <Typography id="about-title" variant="h3" sx={{ fontWeight: 800, mb: 2, lineHeight: 1.2 }}>
                La GMAO qui transforme votre maintenance
              </Typography>
              
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3, fontSize: '1.1rem' }}>
                MaintX centralise l'ensemble de vos processus de maintenance dans une interface unique et moderne. 
                De la gestion des équipements aux rapports d'analyse, optimisez chaque étape de votre maintenance.
              </Typography>

              <Grid container spacing={2} sx={{ mb: 4 }}>
                {features.slice(0, 4).map((feat, index) => (
                  <Grid item xs={6} key={index}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircle sx={{ color: primary, fontSize: 20 }} />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {feat.title}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>

              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForward />}
                onClick={() => handleScroll('features')}
                sx={{
                  px: 4,
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: 'none',
                  bgcolor: primary,
                  '&:hover': { bgcolor: theme.palette.primary.dark }
                }}
              >
                Demander une démo
              </Button>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features Section — image en fond */}
      <Box
        component="section"
        id="features"
        aria-labelledby="features-title"
        sx={{
          position: 'relative',
          py: { xs: 10, md: 14 },
          backgroundImage: `url(${features[0]?.image || HERO_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: alpha('#fff', 0.88),
            pointerEvents: 'none'
          }
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Chip
              label="Fonctionnalités principales"
              sx={{ mb: 2, bgcolor: alpha(primary, 0.1), color: primary }}
            />
            
            <Typography id="features-title" variant="h3" sx={{ fontWeight: 800, mb: 2 }}>
              Une solution complète pour votre maintenance
            </Typography>
            
            <Typography variant="h6" sx={{ color: 'text.secondary', maxWidth: 700, mx: 'auto' }}>
              Découvrez comment MaintX peut transformer votre gestion de maintenance avec des modules intégrés et puissants
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {features.map((feature, index) => (
              <Grid item xs={12} md={6} lg={4} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    borderRadius: 3,
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    border: `1px solid ${alpha(primary, 0.1)}`,
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: `0 20px 40px ${alpha(primary, 0.15)}`,
                      '& .feature-image': {
                        transform: 'scale(1.1)'
                      }
                    }
                  }}
                >
                  <Box sx={{ position: 'relative', overflow: 'hidden', height: 200 }}>
                    <Box
                      className="feature-image"
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `url(${feature.image})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        transition: 'transform 0.6s ease'
                      }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        bgcolor: alpha(primary, 0.9),
                        color: 'white',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 2,
                        fontSize: '0.875rem',
                        fontWeight: 600
                      }}
                    >
                      {feature.stats}
                    </Box>
                  </Box>

                  <CardContent sx={{ p: 3 }}>
                    <Avatar
                      sx={{
                        bgcolor: alpha(primary, 0.1),
                        color: primary,
                        width: 56,
                        height: 56,
                        mb: 2
                      }}
                    >
                      <feature.icon sx={{ fontSize: 32 }} />
                    </Avatar>

                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                      {feature.title}
                    </Typography>

                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                      {feature.description}
                    </Typography>

                    <Divider sx={{ my: 2 }} />

                    <Stack spacing={1}>
                      {feature.benefits?.map((benefit, i) => (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CheckCircle sx={{ color: primary, fontSize: 18 }} />
                          <Typography variant="caption" sx={{ fontWeight: 500 }}>
                            {benefit}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* FAQ */}
      <Box
        component="section"
        id="faq"
        aria-labelledby="faq-title"
        sx={{ py: { xs: 8, md: 10 }, bgcolor: '#fafafa' }}
      >
        <Container maxWidth="md">
          <Typography id="faq-title" variant="h4" sx={{ fontWeight: 800, textAlign: 'center', mb: 4 }}>
            Questions fréquentes
          </Typography>
          {faqItems.map((item, index) => (
            <Accordion
              key={index}
              sx={{
                mb: 1,
                '&:before': { display: 'none' },
                boxShadow: 'none',
                border: `1px solid ${alpha(primary, 0.15)}`,
                borderRadius: '8px !important',
                overflow: 'hidden'
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ fontWeight: 600 }}>
                {item.question}
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <Typography variant="body2" color="text.secondary">
                  {item.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Container>
      </Box>

      {/* CTA Final amélioré */}
      <Box
        id="cta"
        component="section"
        aria-labelledby="cta-title"
        sx={{
          py: { xs: 10, md: 14 },
          background: `linear-gradient(135deg, ${alpha(primary, 0.1)} 0%, ${alpha(primary, 0.05)} 100%)`,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -100,
            right: -100,
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: alpha(primary, 0.1),
            filter: 'blur(80px)'
          }
        }}
      >
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Paper
            sx={{
              p: { xs: 4, md: 6 },
              textAlign: 'center',
              borderRadius: 4,
              bgcolor: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(10px)',
              boxShadow: `0 30px 60px ${alpha(primary, 0.2)}`,
              border: `1px solid ${alpha(primary, 0.2)}`
            }}
          >
            <EmojiEvents sx={{ fontSize: 64, color: primary, mb: 2 }} />
            
            <Typography id="cta-title" variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
              Prêt à révolutionner votre maintenance ?
            </Typography>
            
            <Typography variant="h6" sx={{ color: 'text.secondary', mb: 4, fontWeight: 400 }}>
              Rejoignez les entreprises qui optimisent déjà leur maintenance avec MaintX
            </Typography>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              justifyContent="center"
            >
              <Button
                variant="contained"
                size="large"
                startIcon={<Login />}
                onClick={() => navigate('/login')}
                sx={{
                  px: 4,
                  py: 1.5,
                  borderRadius: 2,
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  background: `linear-gradient(135deg, ${primary} 0%, ${theme.palette.primary.dark} 100%)`,
                  boxShadow: `0 10px 30px ${alpha(primary, 0.4)}`
                }}
              >
                Se connecter
              </Button>
              
              <Button
                variant="outlined"
                size="large"
                startIcon={<Support />}
                href="mailto:contact@maintx.org"
                component="a"
                sx={{
                  px: 4,
                  py: 1.5,
                  borderRadius: 2,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  borderColor: alpha(primary, 0.3),
                  borderWidth: 2,
                  color: primary
                }}
              >
                Contacter un expert
              </Button>
            </Stack>
          </Paper>
        </Container>
      </Box>

      {/* Footer enrichi */}
      <Box
        component="footer"
        sx={{
          py: 4,
          borderTop: '1px solid',
          borderColor: alpha(primary, 0.1),
          bgcolor: '#ffffff'
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                <Box component="span" sx={{ color: primary }}>MAINT</Box>X
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                La GMAO nouvelle génération pour une maintenance optimisée et connectée.
              </Typography>
              <Stack direction="row" spacing={1}>
                {['Mentions légales', 'Confidentialité', 'CGU'].map((item) => (
                  <Button
                    key={item}
                    variant="text"
                    size="small"
                    sx={{ color: 'text.secondary', textTransform: 'none' }}
                  >
                    {item}
                  </Button>
                ))}
              </Stack>
            </Grid>

            <Grid item xs={12} md={8}>
              <Grid container spacing={4}>
                <Grid item xs={4}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Produit
                  </Typography>
                  <Stack spacing={0.5}>
                    <Button variant="text" size="small" onClick={() => handleScroll('features')} sx={{ color: 'text.secondary', textTransform: 'none', justifyContent: 'flex-start' }}>Fonctionnalités</Button>
                    <Button variant="text" size="small" onClick={() => handleScroll('cta')} sx={{ color: 'text.secondary', textTransform: 'none', justifyContent: 'flex-start' }}>Tarifs</Button>
                    <Button variant="text" size="small" onClick={() => handleScroll('faq')} sx={{ color: 'text.secondary', textTransform: 'none', justifyContent: 'flex-start' }}>FAQ</Button>
                    <Button variant="text" size="small" component="a" href="mailto:contact@maintx.org" sx={{ color: 'text.secondary', textTransform: 'none', justifyContent: 'flex-start' }}>Support</Button>
                  </Stack>
                </Grid>

                <Grid item xs={4}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Entreprise
                  </Typography>
                  <Stack spacing={0.5}>
                    <Button variant="text" size="small" onClick={() => handleScroll('about')} sx={{ color: 'text.secondary', textTransform: 'none', justifyContent: 'flex-start' }}>À propos</Button>
                    <Button variant="text" size="small" onClick={() => handleScroll('cta')} sx={{ color: 'text.secondary', textTransform: 'none', justifyContent: 'flex-start' }}>Contact</Button>
                    <Button variant="text" size="small" sx={{ color: 'text.secondary', textTransform: 'none', justifyContent: 'flex-start' }}>Carrières</Button>
                  </Stack>
                </Grid>

                <Grid item xs={4}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Légal
                  </Typography>
                  <Stack spacing={0.5}>
                    {['Confidentialité', 'CGU', 'Mentions'].map((item) => (
                      <Button key={item} variant="text" size="small" sx={{ color: 'text.secondary', textTransform: 'none', justifyContent: 'flex-start' }}>
                        {item}
                      </Button>
                    ))}
                  </Stack>
                </Grid>
              </Grid>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
            © {new Date().getFullYear()} MaintX GMAO. Tous droits réservés.
          </Typography>
        </Container>
      </Box>

      {/* Injection des keyframes */}
      <Box sx={keyframes} />
    </Box>
  );
}