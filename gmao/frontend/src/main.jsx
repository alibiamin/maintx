import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import './App.css';
import App from './App';
import EncodedHashRouter from './components/EncodedHashRouter';
import { AuthProvider } from './context/AuthContext';
import { ThemeModeProvider } from './theme';
import { ActionPanelProvider } from './context/ActionPanelContext';
import { SnackbarProvider } from './context/SnackbarContext';
import { CurrencyProvider } from './context/CurrencyContext';

// EncodedHashRouter : le hash affiche un lien crypté (base64url), pas le chemin réel.
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <EncodedHashRouter>
      <AuthProvider>
        <ThemeModeProvider>
          <CurrencyProvider>
            <SnackbarProvider>
              <ActionPanelProvider>
                <App />
              </ActionPanelProvider>
            </SnackbarProvider>
          </CurrencyProvider>
        </ThemeModeProvider>
      </AuthProvider>
    </EncodedHashRouter>
  </React.StrictMode>
);
