/**
 * Navigation pour le module Projets de maintenance.
 * Tous les chemins doivent être sous /app pour que le Route ne redirige pas vers la Landing.
 */

import { encodePath } from '../../utils/encodedPath';

const APP_BASE = '/app';
const BASE = `${APP_BASE}/maintenance-projects`;

function setHash(path) {
  const fullPath = path.startsWith(APP_BASE) ? path : `${APP_BASE}${path.startsWith('/') ? path : '/' + path}`;
  const encoded = encodePath(fullPath, '');
  window.location.hash = encoded ? `#/${encoded}` : `#/${encodePath(APP_BASE, '')}`;
}

export const projectNav = {
  list: () => setHash(BASE),
  new: () => setHash(`${BASE}/new`),
  detail: (id) => setHash(`${BASE}/${id}`),
  edit: (id) => setHash(`${BASE}/${id}/edit`),
};

/** Navigation vers un chemin app (ex: /app/work-orders/123 ou /work-orders/123) */
export function navigateTo(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  const fullPath = p.startsWith(APP_BASE) ? p : `${APP_BASE}${p}`;
  setHash(fullPath);
}

export default projectNav;
