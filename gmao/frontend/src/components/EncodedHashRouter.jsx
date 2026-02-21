import React, { useState, useEffect, useMemo } from 'react';
import { Router } from 'react-router-dom';
import { getLocationFromHash, encodePath, toPathString } from '../utils/encodedPath';

function pathToLocation(path) {
  const p = path.replace(/\?.*$/, '') || '/';
  const search = path.includes('?') ? '?' + path.split('?').slice(1).join('?') : '';
  return { pathname: p, search };
}

/**
 * Routeur qui affiche un lien crypté (base64url) dans la barre d'adresse.
 * Le hash contient le chemin encodé au lieu de /work-orders, /maintenance-plans, etc.
 */
export default function EncodedHashRouter({ children }) {
  const [location, setLocation] = useState(() => {
    const { pathname, search } = getLocationFromHash();
    return { pathname, search, hash: '', state: null, key: 'default' };
  });

  useEffect(() => {
    const handleHashChange = () => {
      const { pathname, search } = getLocationFromHash();
      setLocation(prev => ({
        pathname,
        search,
        hash: '',
        state: null,
        key: prev?.key ?? 'default'
      }));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigator = useMemo(() => ({
    push(to, state) {
      const path = toPathString(to);
      const { pathname, search } = pathToLocation(path);
      const encoded = encodePath(pathname, search);
      const value = encoded ? `#/${encoded}` : '#/';
      window.location.hash = value;
      setLocation(prev => ({ pathname, search, hash: '', state: state ?? null, key: String(Date.now()) }));
    },
    replace(to, state) {
      const path = toPathString(to);
      const { pathname, search } = pathToLocation(path);
      const encoded = encodePath(pathname, search);
      const value = encoded ? `#/${encoded}` : '#/';
      window.history.replaceState(null, '', window.location.pathname + window.location.search + value);
      setLocation(prev => ({ pathname, search, hash: '', state: state ?? null, key: prev?.key ?? 'default' }));
    },
    go(delta) {
      window.history.go(delta);
    },
    createHref(to) {
      const path = toPathString(to);
      const { pathname, search } = pathToLocation(path);
      const encoded = encodePath(pathname, search);
      return encoded ? `#/${encoded}` : '#/';
    }
  }), []);

  return (
    <Router location={location} navigator={navigator}>
      {children}
    </Router>
  );
}
