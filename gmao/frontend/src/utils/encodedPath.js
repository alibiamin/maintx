/**
 * Encode / decode le chemin d'URL pour l'affichage dans la barre d'adresse.
 * Le hash affiche un lien crypté (base64url) au lieu du chemin réel.
 */

const SLASH = '/';

/** Encode un chemin (ex: /work-orders/123 ou /work-orders?status=1) en base64url pour le hash. */
export function encodePath(pathname, search = '') {
  const path = (pathname || SLASH) + (search || '');
  if (path === SLASH) return '';
  const full = path.startsWith(SLASH) ? path : SLASH + path;
  try {
    return btoa(full)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  } catch {
    return '';
  }
}

/** Convertit la cible "to" du routeur (string ou { pathname, search }) en chemin complet. */
export function toPathString(to) {
  if (typeof to === 'string') return to;
  const p = (to?.pathname ?? SLASH) + (to?.search ?? '');
  return p || SLASH;
}

/** Décode un segment hash base64url vers le chemin réel. */
export function decodePath(encoded) {
  if (!encoded || typeof encoded !== 'string') return SLASH;
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return atob(padded) || SLASH;
  } catch {
    return SLASH;
  }
}

/** Construit pathname + search à partir d'un chemin décodé (ex: /work-orders?status=1). */
function parseDecodedPath(full) {
  if (!full || full === '/') return { pathname: '/', search: '' };
  const idx = full.indexOf('?');
  const pathname = idx === -1 ? full : full.slice(0, idx);
  const search = idx === -1 ? '' : full.slice(idx);
  return { pathname: pathname || '/', search };
}

/** Retourne le chemin décodé à partir de window.location.hash. */
export function getPathFromHash() {
  const hash = typeof window !== 'undefined' ? window.location.hash : '';
  const segment = hash.replace(/^#\/?/, '').trim();
  if (!segment) return '/';
  // Segment base64url (chiffré) : uniquement A-Za-z0-9_-
  if (/^[A-Za-z0-9_-]+$/.test(segment)) {
    const decoded = decodePath(segment);
    return decoded.startsWith('/') ? decoded : '/' + decoded;
  }
  // Ancien format non chiffré (rétrocompat) : ex. work-orders
  return segment.startsWith('/') ? segment : '/' + segment;
}

/** Retourne un objet location { pathname, search } à partir du hash actuel. */
export function getLocationFromHash() {
  const full = getPathFromHash();
  return parseDecodedPath(full);
}

/**
 * Retourne la location pour le routeur : hash si présent, sinon pathname du navigateur.
 * Permet d'ouvrir directement /demande-intervention (sans hash) et d'afficher la bonne page.
 */
export function getLocationForRouter() {
  if (typeof window === 'undefined') return { pathname: '/', search: '' };
  const hash = window.location.hash.replace(/^#\/?/, '').trim();
  if (hash && /^[A-Za-z0-9_-]+$/.test(hash)) {
    const full = decodePath(hash);
    return parseDecodedPath(full.startsWith('/') ? full : '/' + full);
  }
  const pathname = window.location.pathname || '/';
  const search = window.location.search || '';
  if (pathname !== '/' && pathname !== '') {
    return { pathname, search };
  }
  if (hash && !/^[A-Za-z0-9_-]+$/.test(hash)) {
    const full = hash.startsWith('/') ? hash : '/' + hash;
    return parseDecodedPath(full);
  }
  return { pathname: '/', search: '' };
}
