/**
 * Client API centralisé - xmaint
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
  headers: { 'Content-Type': 'application/json' }
});

const token = localStorage.getItem('xmaint-token');
if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

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
      // Réponses paginées ou listes dans .data (catégories, lignes, etc.) : dédupliquer pour éviter doublons d'affichage
      if (Array.isArray(d.data) && d.data.length > 0 && d.data[0] && typeof d.data[0] === 'object' && 'id' in d.data[0]) {
        d.data = deduplicateList(d.data);
      }
    }
    return res;
  },
  (err) => {
    const status = err.response?.status;
    const data = err.response?.data;
    if (status === 401) {
      localStorage.removeItem('xmaint-token');
      delete api.defaults.headers.common['Authorization'];
      const currentPath = getPathFromHash();
      const isLogin = currentPath === '/login' || currentPath === '/';
      if (!isLogin) {
        const enc = encodePath('/login', '');
        window.location.href = window.location.pathname + window.location.search + (enc ? `#/${enc}` : '#/');
      }
    } else if (status === 403 && (data?.code === 'LICENSE_EXPIRED' || data?.code === 'LICENSE_NOT_ACTIVE' || data?.code === 'TENANT_INVALID')) {
      localStorage.removeItem('xmaint-token');
      delete api.defaults.headers.common['Authorization'];
      if (data?.error) sessionStorage.setItem('loginError', data.error);
      const enc = encodePath('/login', '');
      window.location.href = window.location.pathname + window.location.search + (enc ? `#/${enc}` : '#/');
    } else if (status === 403) {
      window.dispatchEvent(new CustomEvent('api-403', { detail: data }));
    }
    return Promise.reject(err);
  }
);

export default api;
