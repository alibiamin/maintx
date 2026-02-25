/**
 * Client API centralisé - xmaint
 * Auth professionnelle : access token en mémoire, refresh via cookie httpOnly.
 * withCredentials: true pour envoyer le cookie refresh à chaque requête.
 */

import axios from 'axios';
import { encodePath, getPathFromHash } from '../utils/encodedPath';

/** Déduplique un tableau d'objets par clé id (ou première clé unique) pour éviter affichages répétés */
function deduplicateList(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return arr;
  const first = arr[0];
  if (first == null || typeof first !== 'object') return arr;
  const keyField = 'id' in first ? 'id' : Object.keys(first)[0];
  if (!keyField) return arr;
  const seen = new Set();
  return arr.filter((item) => {
    const key = item[keyField];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true
});

let refreshPromise = null;

function isRefreshRequest(config) {
  return config?.url?.includes('/auth/refresh');
}

api.interceptors.response.use(
  (res) => {
    const d = res.data;
    if (Array.isArray(d) && d.length > 0 && d[0] && typeof d[0] === 'object' && 'id' in d[0]) {
      res.data = deduplicateList(d);
    } else if (d && typeof d === 'object' && !Array.isArray(d)) {
      for (const key of ['stock', 'sla', 'overduePlans']) {
        if (Array.isArray(d[key]) && d[key].length > 0 && d[key][0] && typeof d[key][0] === 'object' && 'id' in d[key][0]) {
          d[key] = deduplicateList(d[key]);
        }
      }
      if (Array.isArray(d.data) && d.data.length > 0 && d.data[0] && typeof d.data[0] === 'object' && 'id' in d.data[0]) {
        d.data = deduplicateList(d.data);
      }
    }
    return res;
  },
  async (err) => {
    const status = err.response?.status;
    const data = err.response?.data;
    const config = err.config;

    if (status === 401 && config && !config._retried && !isRefreshRequest(config)) {
      config._retried = true;
      try {
        if (!refreshPromise) {
          refreshPromise = api.post('/auth/refresh');
        }
        const res = await refreshPromise;
        refreshPromise = null;
        const token = res.data?.accessToken;
        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
          if (typeof window !== 'undefined' && window.__onRefreshSuccess) {
            const u = res.data?.user;
            const enabledModules = res.data?.enabledModules;
            window.__onRefreshSuccess(token, u ? { ...u, enabledModules: enabledModules ?? u.enabledModules } : u);
          }
          return api.request(config);
        }
      } catch (refreshErr) {
        refreshPromise = null;
        if (typeof window !== 'undefined' && window.__onRefreshFailure) {
          window.__onRefreshFailure();
        }
        api.defaults.headers.common['Authorization'] = '';
        const currentPath = getPathFromHash();
        const isLogin = currentPath === '/login' || currentPath === '/';
        if (!isLogin) {
          const enc = encodePath('/login', '');
          window.location.href = window.location.pathname + window.location.search + (enc ? `#/${enc}` : '#/');
        }
        return Promise.reject(refreshErr);
      }
    }
    refreshPromise = null;

    if (status === 401) {
      delete api.defaults.headers.common['Authorization'];
      if (typeof window !== 'undefined' && window.__onRefreshFailure) {
        window.__onRefreshFailure();
      }
      const currentPath = getPathFromHash();
      const isLogin = currentPath === '/login' || currentPath === '/';
      if (!isLogin) {
        const enc = encodePath('/login', '');
        window.location.href = window.location.pathname + window.location.search + (enc ? `#/${enc}` : '#/');
      }
    } else if (status === 403 && (data?.code === 'LICENSE_EXPIRED' || data?.code === 'LICENSE_NOT_ACTIVE' || data?.code === 'TENANT_INVALID')) {
      delete api.defaults.headers.common['Authorization'];
      if (data?.error) sessionStorage.setItem('loginError', data.error);
      const enc = encodePath('/login', '');
      window.location.href = window.location.pathname + window.location.search + (enc ? `#/${enc}` : '#/');
    } else if (status === 403 && data?.code === 'MODULE_DISABLED') {
      const enc = encodePath('/app', '');
      window.location.href = window.location.pathname + window.location.search + (enc ? `#/${enc}` : '#/');
    } else if (status === 403) {
      window.dispatchEvent(new CustomEvent('api-403', { detail: data }));
    }
    return Promise.reject(err);
  }
);

export function setAuthHeader(accessToken) {
  if (accessToken) {
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

export function setRefreshCallbacks(onSuccess, onFailure) {
  if (typeof window !== 'undefined') {
    window.__onRefreshSuccess = onSuccess;
    window.__onRefreshFailure = onFailure;
  }
}

/**
 * Retourne un message d'erreur lisible à partir d'une erreur axios (réponses 400/404/500).
 */
export function getApiErrorMessage(err, fallback = 'Erreur') {
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;
  if (typeof data.error === 'string') return data.error;
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    const first = data.errors[0];
    return (typeof first === 'object' && first?.msg) ? first.msg : String(first);
  }
  return fallback;
}

export default api;
