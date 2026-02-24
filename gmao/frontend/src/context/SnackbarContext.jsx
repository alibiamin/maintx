import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Snackbar, Alert } from '@mui/material';

const SnackbarContext = createContext(null);

export function SnackbarProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('success');

  const show = useCallback((msg, sev = 'success') => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);
  }, []);

  const showSuccess = useCallback((msg) => show(msg, 'success'), [show]);
  const showError = useCallback((msg) => show(msg, 'error'), [show]);
  const showInfo = useCallback((msg) => show(msg, 'info'), [show]);

  useEffect(() => {
    const on403 = (e) => {
      const msg = e?.detail?.error || 'Accès refusé - permissions insuffisantes';
      showError(msg);
    };
    window.addEventListener('api-403', on403);
    return () => window.removeEventListener('api-403', on403);
  }, [showError]);

  const handleClose = (_, reason) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  return (
    <SnackbarContext.Provider value={{ showSuccess, showError, showInfo, show }}>
      {children}
      <Snackbar open={open} autoHideDuration={5000} onClose={handleClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={handleClose} severity={severity} variant="filled">
          {message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const ctx = useContext(SnackbarContext);
  return ctx || { showSuccess: () => {}, showError: () => {}, showInfo: () => {}, show: () => {} };
}
