# Sidebar d'Actions Dynamique et Intelligente

## Vue d'ensemble

La sidebar d'actions est un panneau latéral intelligent qui s'ouvre à droite de l'écran pour gérer toutes les actions utilisateur (création, modification, suppression, impression, export, etc.).

## Fonctionnalités

- ✅ **Dynamique** : S'adapte au contexte (liste vs entité)
- ✅ **Intelligente** : Actions contextuelles selon le type d'entité
- ✅ **Personnalisable** : Actions personnalisées par page
- ✅ **Actions rapides** : Boutons d'actions rapides en bas du panneau
- ✅ **Informations contextuelles** : Affiche les détails de l'entité sélectionnée

## Utilisation de base

### 1. Pour une liste (actions de création)

```jsx
import { useActionPanelHelpers } from '../../hooks/useActionPanel';

function MyListPage() {
  const { openListPanel } = useActionPanelHelpers();

  return (
    <Button onClick={() => openListPanel('equipment')}>
      Actions
    </Button>
  );
}
```

### 2. Pour une entité spécifique

```jsx
import { useActionPanelHelpers } from '../../hooks/useActionPanel';

function MyListPage() {
  const { openEntityPanel } = useActionPanelHelpers();

  const handleRowClick = (item) => {
    openEntityPanel('equipment', item);
  };

  return (
    <TableRow onClick={() => handleRowClick(equipment)}>
      {/* ... */}
    </TableRow>
  );
}
```

### 3. Actions personnalisées

```jsx
import { useActionPanelHelpers } from '../../hooks/useActionPanel';
import { useActionPanel } from '../../context/ActionPanelContext';

function MyPage() {
  const { openPanel } = useActionPanel();

  const handleCustomAction = () => {
    openPanel({
      title: 'Actions personnalisées',
      entity: { name: 'Mon équipement', code: 'EQ001' },
      actions: [
        {
          id: 'custom1',
          label: 'Action personnalisée',
          icon: <CustomIcon />,
          color: 'primary',
          onClick: (entity) => {
            console.log('Action sur', entity);
          }
        },
        {
          id: 'custom2',
          label: 'Action sans fermeture',
          icon: <OtherIcon />,
          closeAfterClick: false, // Le panneau reste ouvert
          onClick: () => {
            // Logique
          }
        },
        { divider: true }, // Séparateur
        {
          id: 'quick',
          label: 'Action rapide',
          icon: <QuickIcon />,
          quick: true, // Apparaît dans le footer
          onClick: () => {}
        }
      ]
    });
  };
}
```

## Structure des actions

Chaque action peut avoir les propriétés suivantes :

```typescript
{
  id: string,                    // Identifiant unique
  label: string,                  // Texte de l'action
  icon: ReactNode,                // Icône Material-UI
  color?: 'primary' | 'error' | 'default',
  description?: string,           // Description secondaire
  onClick?: (entity) => void,     // Fonction appelée au clic
  disabled?: boolean,              // Désactiver l'action
  closeAfterClick?: boolean,      // Fermer après clic (défaut: true)
  quick?: boolean,                // Afficher dans le footer
  badge?: string,                 // Badge à afficher
  variant?: 'contained'           // Style de l'action
}
```

## Types d'entités supportés

- `equipment` - Équipements
- `work-orders` - Ordres de travail
- `maintenance-plans` - Plans de maintenance
- `stock` - Pièces de rechange
- `suppliers` - Fournisseurs
- `contracts` - Contrats
- `tools` - Outils
- `checklists` - Checklists
- `sites` - Sites
- `users` - Utilisateurs

## Exemple complet

Voir `EquipmentList.jsx` pour un exemple complet d'utilisation.
