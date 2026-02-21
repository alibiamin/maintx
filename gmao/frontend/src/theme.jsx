import React, { createContext, useContext, useMemo, useState } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const ThemeModeContext = createContext();

function getInitialTheme() {
  const current = localStorage.getItem('xmaint-theme');
  if (current === 'light') return 'light';
  // Toujours démarrer en mode clair : si dark était enregistré, on bascule vers light
  if (current === 'dark') {
    localStorage.setItem('xmaint-theme', 'light');
    return 'light';
  }
  const legacy = localStorage.getItem('gmao-theme');
  if (legacy === 'light') {
    localStorage.setItem('xmaint-theme', 'light');
    return 'light';
  }
  if (legacy === 'dark') {
    localStorage.setItem('xmaint-theme', 'light');
    return 'light';
  }
  return 'light';
}

export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState(getInitialTheme);

  const toggleTheme = () => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('xmaint-theme', next);
      return next;
    });
  };

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ThemeModeContext.Provider value={{ mode, toggleTheme }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}

// Palette inspirée Sage X3 : noir, blanc, vert vif, bleu-gris clair, accent orange
export const THEME_COLORS = {
  primary: '#2EB23E',      // Vert Sage
  primaryLight: '#3dd04d',
  primaryDark: '#259633',
  secondary: '#F0F8FF',    // Bleu-gris clair (inputs)
  accent: '#FFBF00',       // Orange/jaune focus
  background: '#000000',   // Noir
  paper: '#FFFFFF',        // Blanc (cartes)
  text: '#333333',
  textSecondary: '#64748b'
};

export function createAppTheme(mode) {
  const isDark = mode === 'dark';
  const bgBase = isDark ? THEME_COLORS.background : '#f5f7fa';
  const cardBg = isDark ? 'rgba(30, 35, 45, 0.95)' : THEME_COLORS.paper;

  return createTheme({
    palette: {
      mode,
      primary: { main: THEME_COLORS.primary, light: THEME_COLORS.primaryLight, dark: THEME_COLORS.primaryDark },
      secondary: { main: THEME_COLORS.secondary, light: '#e8f4ff', dark: '#b8d4e8' },
      success: { main: THEME_COLORS.primary },
      warning: { main: THEME_COLORS.accent },
      error: { main: '#ef4444' },
      background: {
        default: bgBase,
        paper: cardBg
      }
    },
    typography: {
      fontFamily: '"Outfit", "Segoe UI", system-ui, sans-serif',
      h4: { fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontWeight: 600, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600 }
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600 }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            background: isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(12px)',
            border: isDark ? '1px solid rgba(148, 163, 184, 0.1)' : '1px solid rgba(0,0,0,0.06)',
            boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.4)' : '0 4px 24px rgba(0,0,0,0.06)'
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backdropFilter: 'blur(12px)',
            border: isDark ? '1px solid rgba(148, 163, 184, 0.08)' : '1px solid rgba(0,0,0,0.06)'
          }
        }
      }
    }
  });
}
