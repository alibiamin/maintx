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
    }
    return res;
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('xmaint-token');
      delete api.defaults.headers.common['Authorization'];
      const currentPath = getPathFromHash();
      const isLogin = currentPath === '/login' || currentPath === '/';
      if (!isLogin) {
        const enc = encodePath('/login', '');
        window.location.href = window.location.pathname + window.location.search + (enc ? `#/${enc}` : '#/');
      }
    }
    return Promise.reject(err);
  }
);

export default api;
