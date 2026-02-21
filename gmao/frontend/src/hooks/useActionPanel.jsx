/**
 * Hook utilitaire pour faciliter l'utilisation du panneau d'actions
 */

import React from 'react';
import { useActionPanel } from '../context/ActionPanelContext';
import { useNavigate } from 'react-router-dom';
import {
  Add,
  Edit,
  Delete,
  Print,
  Download,
  Share,
  Visibility,
  FileCopy,
  Archive,
  Settings
} from '@mui/icons-material';

export const useActionPanelHelpers = () => {
  const { openPanel, closePanel } = useActionPanel();
  const navigate = useNavigate();

  // Ouvrir le panneau pour une entité spécifique
  const openEntityPanel = (entityType, entity, customActions = []) => {
    const actions = [
      {
        id: 'view',
        label: 'Voir les détails',
        icon: <Visibility />,
        color: 'primary',
        onClick: () => navigate(`/${entityType}/${entity.id}`)
      },
      {
        id: 'edit',
        label: 'Modifier',
        icon: <Edit />,
        color: 'primary',
        onClick: () => navigate(`/${entityType}/${entity.id}/edit`)
      },
      {
        id: 'duplicate',
        label: 'Dupliquer',
        icon: <FileCopy />,
        color: 'default',
        onClick: () => {
          // Logique de duplication
          console.log('Dupliquer', entity);
        }
      },
      { divider: true },
      {
        id: 'print',
        label: 'Imprimer',
        icon: <Print />,
        color: 'default',
        quick: true,
        onClick: () => {
          window.print();
        }
      },
      {
        id: 'export',
        label: 'Exporter',
        icon: <Download />,
        color: 'default',
        quick: true,
        onClick: () => {
          // Logique d'export
          console.log('Exporter', entity);
        }
      },
      {
        id: 'share',
        label: 'Partager',
        icon: <Share />,
        color: 'default',
        onClick: () => {
          // Logique de partage
          console.log('Partager', entity);
        }
      },
      { divider: true },
      {
        id: 'delete',
        label: 'Supprimer',
        icon: <Delete />,
        color: 'error',
        onClick: () => {
          if (window.confirm(`Êtes-vous sûr de vouloir supprimer ${entity.name || entity.code || 'cet élément'} ?`)) {
            // Logique de suppression
            console.log('Supprimer', entity);
          }
        }
      },
      ...customActions
    ];

    openPanel({
      title: `Actions - ${entity.name || entity.code || entityType}`,
      entity,
      entityType,
      actions
    });
  };

  // Ouvrir le panneau pour une liste (actions de création)
  const openListPanel = (entityType, customActions = []) => {
    const labels = {
      equipment: 'Équipement',
      'work-orders': 'Ordre de travail',
      'maintenance-plans': 'Plan de maintenance',
      stock: 'Pièce',
      suppliers: 'Fournisseur',
      contracts: 'Contrat',
      tools: 'Outil',
      checklists: 'Checklist',
      sites: 'Site',
      users: 'Utilisateur'
    };

    const actions = [
      {
        id: 'create',
        label: `Créer un ${labels[entityType] || entityType}`,
        icon: <Add />,
        color: 'primary',
        variant: 'contained',
        onClick: () => navigate('/creation')
      },
      {
        id: 'import',
        label: 'Importer',
        icon: <Download />,
        color: 'default',
        onClick: () => {
          // Logique d'import
          console.log('Importer', entityType);
        }
      },
      { divider: true },
      {
        id: 'print',
        label: 'Imprimer la liste',
        icon: <Print />,
        color: 'default',
        onClick: () => window.print()
      },
      {
        id: 'export',
        label: 'Exporter la liste',
        icon: <Download />,
        color: 'default',
        onClick: () => {
          // Logique d'export
          console.log('Exporter liste', entityType);
        }
      },
      {
        id: 'settings',
        label: 'Paramètres d\'affichage',
        icon: <Settings />,
        color: 'default',
        onClick: () => {
          // Logique de paramètres
          console.log('Paramètres', entityType);
        }
      },
      ...customActions
    ];

    openPanel({
      title: `Actions - ${labels[entityType] || entityType}`,
      entityType,
      actions
    });
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
