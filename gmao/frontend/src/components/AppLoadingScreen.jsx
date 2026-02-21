import React from 'react';
import { Box, keyframes } from '@mui/material';
import Logo from './Logo';

const fadeIn = keyframes`
  0% { opacity: 0; }
  100% { opacity: 1; }
`;

const softPulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.92; transform: scale(1.02); }
`;

const spinnerRotate = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const spinnerDash = keyframes`
  0% { stroke-dasharray: 1, 200; stroke-dashoffset: 0; }
  50% { stroke-dasharray: 90, 200; stroke-dashoffset: -35; }
  100% { stroke-dasharray: 1, 200; stroke-dashoffset: -125; }
`;

/**
 * Écran de chargement : logo + nom de l'application, spinner avec animations fluides.
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
        gap: 12,
        animation: `${fadeIn} 0.5s ease-out forwards`,
      }}
    >
      <Box
        sx={{
          animation: `${softPulse} 2s ease-in-out infinite`,
        }}
      >
        <Logo variant="dark" size="xlarge" showText />
      </Box>
      <Box
        component="span"
        sx={{
          display: 'inline-block',
          width: 64,
          height: 64,
          '& svg': {
            animation: `${spinnerRotate} 1.4s linear infinite`,
          },
          '& circle': {
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 3,
            strokeLinecap: 'round',
            strokeDasharray: '1, 200',
            strokeDashoffset: 0,
            animation: `${spinnerDash} 1.4s ease-in-out infinite`,
            color: 'primary.main',
          },
        }}
      >
        <svg viewBox="22 22 44 44" style={{ width: '100%', height: '100%' }}>
          <circle cx="44" cy="44" r="20.2" />
        </svg>
      </Box>
    </Box>
  );
}
