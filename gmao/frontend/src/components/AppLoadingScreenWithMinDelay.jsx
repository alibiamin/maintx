import React, { useState, useRef, useEffect } from 'react';
import AppLoadingScreen from './AppLoadingScreen';

const MIN_DISPLAY_MS = 3000;

/**
 * Affiche AppLoadingScreen tant que loading est true, puis au moins minDisplayMs
 * à partir du premier affichage, avant de rendre children.
 */
export default function AppLoadingScreenWithMinDelay({ loading, children, minDisplayMs = MIN_DISPLAY_MS }) {
  const [canHide, setCanHide] = useState(false);
  const startedAtRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (loading) {
      startedAtRef.current = Date.now();
      setCanHide(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCanHide(true), minDisplayMs);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [loading, minDisplayMs]);

  const mustWaitMinDelay = startedAtRef.current !== null && !canHide;
  const showLoading = loading || mustWaitMinDelay;
  if (showLoading) return <AppLoadingScreen />;
  return children;
}
