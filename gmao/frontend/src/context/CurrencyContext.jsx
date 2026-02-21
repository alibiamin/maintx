import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const CurrencyContext = createContext({ currency: '€', refresh: () => {} });

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState('€');

  const refresh = useCallback(() => {
    api.get('/settings/currency')
      .then((r) => setCurrency(r.data?.value || '€'))
      .catch(() => setCurrency('€'));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <CurrencyContext.Provider value={{ currency, refresh }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  return ctx?.currency ?? '€';
}

export function useCurrencyRefresh() {
  const ctx = useContext(CurrencyContext);
  return ctx?.refresh ?? (() => {});
}
