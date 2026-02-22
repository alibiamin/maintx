import React from 'react';
import { Box, Typography, keyframes } from '@mui/material';

const fadeIn = keyframes`
  0% { opacity: 0; }
  100% { opacity: 1; }
`;

const bounce = keyframes`
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
`;

/**
 * Écran de chargement : MAINTX + spinner moderne (points animés).
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
        animation: `${fadeIn} 0.5s ease-out forwards`,
      }}
    >
      <Typography
        component="span"
        sx={{
          fontSize: '7rem',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: 'text.primary',
        }}
      >
        MAINT
        <Box component="span" sx={{ color: 'primary.main' }}>X</Box>
      </Typography>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          mt: 2,
        }}
      >
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              animation: `${bounce} 1.4s ease-in-out infinite both`,
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
