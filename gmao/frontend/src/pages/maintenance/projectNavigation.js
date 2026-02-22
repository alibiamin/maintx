/**
 * Navigation pour le module Projets de maintenance.
 * Utilise le hash encodé (EncodedHashRouter) pour éviter les bugs de clic.
 */

import { encodePath } from '../../utils/encodedPath';

const BASE = '/maintenance-projects';

function setHash(path) {
  const encoded = encodePath(path, '');
  window.location.hash = encoded ? `#/${encoded}` : '#/';
}

export const projectNav = {
  list: () => setHash(BASE),
  new: () => setHash(`${BASE}/new`),
  detail: (id) => setHash(`${BASE}/${id}`),
  edit: (id) => setHash(`${BASE}/${id}/edit`),
};

/** Navigation vers n'importe quel chemin (ex: /work-orders/123) */
export function navigateTo(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  setHash(p);
}

export default projectNav;
