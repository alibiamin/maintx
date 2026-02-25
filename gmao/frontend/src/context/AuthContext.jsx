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
  }, []); // newUser may include enabledModules when provided by interceptor

  useEffect(() => {
    api.post('/auth/refresh')
      .then((res) => {
        const { accessToken, user: u, enabledModules } = res.data || {};
        if (accessToken && u) {
          setAuthHeader(accessToken);
          setUser({ ...u, enabledModules: enabledModules ?? u.enabledModules });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { accessToken, user: u, enabledModules } = res.data;
    setAuthHeader(accessToken);
    setUser(u ? { ...u, enabledModules: enabledModules ?? u.enabledModules } : u);
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
      const data = res.data;
      setUser(prev => (prev ? {
        ...prev,
        ...data,
        permissions: data.permissions ?? prev.permissions,
        enabledModules: data.enabledModules !== undefined ? data.enabledModules : prev.enabledModules
      } : data));
      return data;
    } catch (_) {
      return null;
    }
  };

  const permissions = user?.permissions ?? [];
  const enabledModules = user?.enabledModules ?? null;
  const can = (resource, action) => permissions.includes(`${resource}.${action}`);
  /** true = module activé ou pas de restriction. Route sans module (null/undefined) = toujours autorisée (isolation). */
  const isModuleEnabled = (moduleCode) => {
    if (moduleCode == null || moduleCode === '') return true;
    return enabledModules == null || (Array.isArray(enabledModules) && enabledModules.includes(moduleCode));
  };

  const value = { user, loading, login, logout, refreshMe, isAuthenticated: !!user, permissions, can, enabledModules, isModuleEnabled };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
