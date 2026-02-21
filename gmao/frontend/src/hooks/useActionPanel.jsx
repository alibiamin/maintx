/**
 * Hook utilitaire pour faciliter l'utilisation du panneau d'actions
 */

import React from 'react';
import { useActionPanel } from '../context/ActionPanelContext';

export const useActionPanelHelpers = () => {
  const { openPanel, closePanel, setContext } = useActionPanel();

  // Mettre à jour la sidebar pour une entité sélectionnée (contexte dynamique)
  const openEntityPanel = (entityType, entity) => {
    setContext({ type: 'list', entityType, selectedEntity: entity });
  };

  // Mettre à jour la sidebar pour une liste (actions de création, sans sélection)
  const openListPanel = (entityType) => {
    setContext({ type: 'list', entityType });
  };

  // Ouvrir un panneau personnalisé
  const openCustomPanel = (title, actions, entity = null) => {
    openPanel({
      title,
      actions,
      entity,
      entityType: null
    });
  };

  return {
    openEntityPanel,
    openListPanel,
    openCustomPanel,
    closePanel,
    openPanel
  };
};
