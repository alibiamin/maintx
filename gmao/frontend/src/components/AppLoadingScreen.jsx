import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import Logo from './Logo';

/**
 * Écran de chargement affiché à l'ouverture de l'application et après connexion :
 * fond blanc, logo centré, spinner.
 */
export default function AppLoadingScreen() {
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        backgroundColor: '#fff',
      }}
    >
      <Logo variant="dark" size="xlarge" showText />
      <CircularProgress size={40} thickness={4} sx={{ color: 'primary.main' }} />
    </Box>
  );
}
