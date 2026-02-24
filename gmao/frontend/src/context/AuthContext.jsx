import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('xmaint-token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const timeoutId = setTimeout(() => setLoading(false), 10000);
      api.get('/auth/me')
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('xmaint-token');
          delete api.defaults.headers.common['Authorization'];
        })
        .finally(() => {
          clearTimeout(timeoutId);
          setLoading(false);
        });
      return () => clearTimeout(timeoutId);
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user: u } = res.data;
    localStorage.setItem('xmaint-token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(u);
    return u;
  };

  const logout = () => {
    localStorage.removeItem('xmaint-token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const value = { user, loading, login, logout, isAuthenticated: !!user };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
