import { useEffect } from 'react';

/**
 * Affiche un avertissement navigateur si l'utilisateur quitte la page (rechargement, fermeture)
 * alors que isDirty est true (formulaire modifié non enregistré).
 * @param {boolean} isDirty - true si le formulaire a été modifié
 */
export function useConfirmLeave(isDirty) {
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);
}
