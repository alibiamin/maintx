import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { setAuthHeader, setRefreshCallbacks } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setRefreshCallbacks(
      (accessToken, newUser) => {
        setAuthHeader(accessToken);
        if (newUser) setUser(newUser);
      },
      () => {
        setAuthHeader(null);
        setUser(null);
      }
    );
    return () => setRefreshCallbacks(null, null);
  }, []);

  useEffect(() => {
    api.post('/auth/refresh')
      .then((res) => {
        const { accessToken, user: u } = res.data || {};
        if (accessToken && u) {
          setAuthHeader(accessToken);
          setUser(u);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { accessToken, user: u } = res.data;
    setAuthHeader(accessToken);
    setUser(u);
    return u;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (_) {}
    setAuthHeader(null);
    setUser(null);
  };

  const refreshMe = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(prev => (prev ? { ...prev, ...res.data, permissions: res.data.permissions ?? prev.permissions } : res.data));
      return res.data;
    } catch (_) {
      return null;
    }
  };

  const permissions = user?.permissions ?? [];
  const can = (resource, action) => permissions.includes(`${resource}.${action}`);

  const value = { user, loading, login, logout, refreshMe, isAuthenticated: !!user, permissions, can };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
