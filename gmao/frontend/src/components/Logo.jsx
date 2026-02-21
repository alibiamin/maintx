import React from 'react';
import { Box, Typography } from '@mui/material';

/** URL du logo image (favicon) utilisé aussi dans l'interface */
export const LOGO_IMAGE_SRC = '/logomaintx.ico';

/**
 * Logo maintx — image (logomaintx.ico) ou vectoriel selon logoSrc.
 * variant: "light" (fond sombre/vert) | "dark" (fond clair)
 * size: "small" (header) | "medium" | "large" (login)
 */
const LOGO_COLORS = {
  light: {
    iconPrimary: '#ffffff',
    iconSecondary: 'rgba(255,255,255,0.85)',
    main: '#ffffff',
    sub: 'rgba(255,255,255,0.9)'
  },
  dark: {
    iconPrimary: '#259633',
    iconSecondary: '#2EB23E',
    main: '#1a1a1a',
    sub: '#259633'
  }
};

const SIZES = {
  small: { icon: 32, main: '1rem', sub: '0.65rem', gap: 0.75 },
  medium: { icon: 44, main: '1.25rem', sub: '0.75rem', gap: 1 },
  large: { icon: 52, main: '1.5rem', sub: '0.85rem', gap: 1.25 }
};

function LogoIcon({ size, colors, sx = {} }) {
  const s = size;
  return (
    <Box
      component="svg"
      viewBox="0 0 48 48"
      sx={{
        width: s,
        height: s,
        flexShrink: 0,
        ...sx
      }}
    >
      {/* M stylisé : deux montants + pointe centrale — épuré et professionnel */}
      <path
        d="M8 42V18L24 34L40 18v24"
        fill="none"
        stroke={colors.iconPrimary}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 18l16 16 16-16"
        fill="none"
        stroke={colors.iconSecondary}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Box>
  );
}

export default function Logo({ variant = 'dark', size = 'medium', showText = true, logoSrc = LOGO_IMAGE_SRC, sx = {} }) {
  const colors = LOGO_COLORS[variant] || LOGO_COLORS.dark;
  const dim = SIZES[size] || SIZES.medium;
  const useImage = Boolean(logoSrc);

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: dim.gap,
        ...sx
      }}
    >
      {useImage ? (
        <Box
          component="img"
          src={logoSrc}
          alt="maintx"
          sx={{ width: dim.icon, height: dim.icon, flexShrink: 0, objectFit: 'contain' }}
        />
      ) : (
        <LogoIcon size={dim.icon} colors={colors} />
      )}
      {showText && (
        <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <Typography
            component="span"
            sx={{
              fontSize: dim.main,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: colors.main
            }}
          >
            maintx
          </Typography>
          <Typography
            component="span"
            sx={{
              fontSize: dim.sub,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: colors.sub
            }}
          >
            xmaint.org
          </Typography>
        </Box>
      )}
    </Box>
  );
}

/** Logo compact pour le header : image + nom, sans animation */
export function LogoCompact({ variant = 'light', size = 40, sx = {} }) {
  const colors = LOGO_COLORS[variant] || LOGO_COLORS.light;
  const iconSize = Math.round(size * 0.85);
  const fontSize = Math.max(size * 0.5, 18);
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1.25,
        ...sx
      }}
    >
      <Box
        component="img"
        src={LOGO_IMAGE_SRC}
        alt=""
        sx={{ width: iconSize, height: iconSize, flexShrink: 0, objectFit: 'contain' }}
      />
      <Typography
        component="span"
        sx={{
          fontSize,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: colors.main,
          textTransform: 'lowercase',
          fontFamily: '"Outfit", "Segoe UI", system-ui, sans-serif'
        }}
      >
        maintx
      </Typography>
    </Box>
  );
}
