import React, { createContext, useContext, useMemo } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const ThemeModeContext = createContext({ mode: 'light', toggleTheme: () => {} });

export function ThemeModeProvider({ children }) {
  const theme = useMemo(() => createAppTheme(), []);

  return (
    <ThemeModeContext.Provider value={{ mode: 'light', toggleTheme: () => {} }}>
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

export function createAppTheme() {
  return createTheme({
    palette: {
      mode: 'light',
      primary: { main: THEME_COLORS.primary, light: THEME_COLORS.primaryLight, dark: THEME_COLORS.primaryDark },
      secondary: { main: THEME_COLORS.secondary, light: '#e8f4ff', dark: '#b8d4e8' },
      success: { main: THEME_COLORS.primary },
      warning: { main: THEME_COLORS.accent },
      error: { main: '#ef4444' },
      background: {
        default: '#f5f7fa',
        paper: THEME_COLORS.paper
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
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0,0,0,0.06)'
          }
        }
      }
    }
  });
}
