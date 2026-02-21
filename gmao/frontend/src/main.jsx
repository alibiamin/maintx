import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeModeProvider } from './theme';
import { ActionPanelProvider } from './context/ActionPanelContext';
import { SnackbarProvider } from './context/SnackbarContext';
import { CurrencyProvider } from './context/CurrencyContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
    </BrowserRouter>
  </React.StrictMode>
);
