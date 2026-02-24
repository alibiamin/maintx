# Audit UX GMAO — Utilisateur final (technicien / superviseur / responsable maintenance)

*Audit réalisé sur les flux réels : création d’équipements, ordres de travail, erreurs volontaires, suppressions, navigation. Objectif : repérer les blocages, les confusions et proposer des recommandations concrètes.*

---

## ❌ Ce qui gêne ou bloque

### 1. **Bouton « Supprimer » du panneau d’actions inopérant**
- **Où :** Panneau d’actions à droite (liste ou fiche d’un équipement, OT, etc.).
- **Comportement :** Un clic sur « Supprimer » affiche bien la boîte de confirmation (`Supprimer [nom] ?`), mais après avoir cliqué « OK », **rien ne se passe** : l’entité n’est pas supprimée.
- **Cause :** Le gestionnaire du bouton ne fait qu’un `window.confirm()` ; l’appel API de suppression n’est pas implémenté dans ce flux.
- **Impact :** L’utilisateur pense avoir supprimé un équipement ou un OT et constate que l’élément est toujours là → perte de confiance et confusion.

### 2. **Suppressions sans confirmation (risque de clic hasardeux)**
- **Où :** Fiche équipement — seuils d’alerte et lignes de nomenclature (BOM).
- **Comportement :** Un clic sur l’icône « Supprimer » d’un seuil ou d’une pièce en BOM supprime **immédiatement** sans aucune demande de confirmation.
- **Impact :** Un clic accidentel ou un double-clic entraîne une suppression définitive. Pour un utilisateur non technique, la réversibilité n’est pas évidente.

### 3. **Création d’équipement : pas de bouton visible sur la liste**
- **Où :** Page « Équipements » (liste).
- **Comportement :** Il n’y a **pas de bouton « Nouvel équipement »** (ou équivalent) directement sur la page. La création se fait uniquement via :
  - le **menu latéral** (Équipements → Création → Site / Département / Ligne / Machine / Section / Composant / Sous-composant), ou
  - le **panneau d’actions** (« Créer un Équipement ») si l’utilisateur a compris qu’il faut l’ouvrir.
- **Impact :** Un technicien ou un responsable qui veut « ajouter une machine » depuis la liste ne voit pas d’action évidente ; le parcours n’est pas intuitif.

### 4. **Perte des données en cas de rechargement ou de navigation**
- **Où :** Tous les formulaires longs (création équipement, OT, pièce, etc.).
- **Comportement :** Aucun avertissement avant de quitter la page (pas de `beforeunload` / « Les modifications non enregistrées seront perdues »). Si l’utilisateur recharge la page, change d’onglet, ou utilise le bouton « Retour » du navigateur, **tout le formulaire est perdu**.
- **Impact :** Très frustrant sur des formulaires avec beaucoup de champs (OT avec réservations, checklists, etc.).

### 5. **Création « Machine » : dépendance au site et au code**
- **Où :** Page Création → type « Machine » (ou Section / Composant / Sous-composant).
- **Comportement :** Le bouton « Créer » reste désactivé tant que les champs obligatoires ne sont pas remplis. Pour une **machine**, il faut au minimum : **Site** + **Nom** (+ **Code** si la codification auto n’est pas activée). Si l’utilisateur ne choisit pas de site (ou que les sites ne sont pas encore créés), il ne peut pas valider.
- **Impact :** En environnement neuf (aucun site), l’utilisateur peut être bloqué sans message explicite du type « Créez d’abord un site ».

---

## ⚠️ Ce qui est confus

### 1. **Deux façons de créer un ordre de travail**
- **Flux 1 :** Menu Maintenance → « Déclarer une panne / Créer un OT » ou liste des OT → « Nouvel OT » → **page Création** (`/app/maintenance/creation/work-order`) avec onglets par type (Plan, Checklist, **Ordre de travail**).
- **Flux 2 :** Depuis les plans de maintenance (Exécuter / Créer un OT) → **formulaire dédié** (`/app/work-orders/new`) avec titre, équipement, type, priorité, etc.
- **Conséquence :** Deux écrans différents pour « créer un OT ». Un utilisateur peut ne pas savoir lequel utiliser ni pourquoi il arrive parfois sur la page « Création » générique et parfois sur un formulaire OT spécifique.

### 2. **Libellés et orthographe incohérents**
- **Formulaire OT dédié** (`WorkOrderForm`) : titres « Declarer une panne / Creer un OT », « Creer », « Debut prevu », « Fin prevue » (accents manquants).
- **Cohérence :** Ailleurs l’interface est en français correct ; ces écrans donnent une impression de brouillon et nuisent à la crédibilité.

### 3. **Hiérarchie équipement (Site → Département → Ligne → Machine → Section → Composant)**
- La création d’une **section** exige une **ligne** et un **équipement parent (machine)**. Celle d’un **composant** exige en plus une **section parent**, etc.
- Les libellés « Machine / Équipement parent », « Section parent », « Composant parent » sont techniques ; pour un non-initié, « parent » peut prêter à confusion (qui est le « parent » dans l’arbre ?).

### 4. **Panneau d’actions (droite) peu visible ou replié**
- Les actions « Créer un équipement », « Modifier », « Supprimer » dépendent du **panneau d’actions** à droite. S’il est **réduit** (épinglé à « fermé »), l’utilisateur ne voit qu’une petite icône et peut ignorer qu’il existe un bouton « Créer » ou « Supprimer ».
- Pas d’équivalent systématique en bouton principal dans le contenu de la page (ex. « Nouvel équipement » en haut de la liste).

### 5. **Confirmation native du navigateur pour les suppressions**
- Beaucoup de suppressions (catégories, checklists, documents, opérateurs OT, etc.) utilisent **`window.confirm()`**.
- **Problèmes :** style différent du reste de l’app, pas d’explication des conséquences (ex. « Les sous-familles rattachées seront supprimées »), et selon le navigateur/OS le libellé peut être en anglais ou peu lisible.

### 6. **Statuts OT vs workflow**
- L’application gère à la fois un **statut** (pending, in_progress, completed…) et un **workflow** (draft, planned, in_progress…). Sur la fiche OT, les boutons (Démarrer, Marquer la fin, Clôturer) dépendent de ces états.
- Un utilisateur peut ne pas comprendre pourquoi « Démarrer » est désactivé (ex. statut = draft au lieu de planned) ou quelle est la différence entre « Marquer la fin » et « Clôturer ».

---

## ✅ Ce qui est clair et fluide

### 1. **Liste des équipements**
- Filtres (recherche, statut, catégorie, ligne), tri (code, nom), pagination et libellés (« Équipements », « Gestion des actifs et fiches techniques ») sont clairs.
- Clic sur une ligne pour sélectionner ou pour aller à l’historique / documents / garanties selon le mode (paramètre `view`).

### 2. **Formulaire de création d’équipement (type Machine)**
- Une fois sur la page Création → Machine, les champs sont regroupés de façon logique (Hiérarchie : Site, Département, Ligne ; Code / Nom ; Catégorie, N° série ; Criticité, Statut).
- Message d’aide : « Hiérarchie : sélectionnez d’abord le site, puis le département et la ligne. »

### 3. **Fiche ordre de travail**
- Informations principales visibles (titre, équipement, statut, priorité, dates, responsable).
- Actions métier bien identifiées : Démarrer, Marquer la fin, Clôturer (avec signature), affectation d’opérateurs, pièces consommées, documents, impression PDF.

### 4. **Messages de retour (snackbar)**
- Succès / erreur après création, modification, suppression (là où l’API est appelée) : « Élément créé », « Statut mis à jour », « Seuil supprimé », etc.
- En cas d’erreur API, le message renvoyé par le backend est affiché (ex. « Erreur lors de la création »).

### 5. **Bouton « Retour » et annulation**
- Les formulaires (création équipement, OT, etc.) ont un bouton « Retour » ou « Annuler » qui ramène à la liste ou à la page précédente, ce qui évite de rester bloqué.

### 6. **Menu de navigation**
- Structure lisible : Dashboard, Équipements, Maintenance, Stock, Fournisseurs, Outils, etc., avec sous-menus (liste, carte, catégories, création par type). Un utilisateur qui sait où il va trouve rapidement le bon écran.

---

## 🎯 Recommandations UX concrètes

### Blocages à traiter en priorité

1. **Implémenter la suppression réelle dans le panneau d’actions**  
   Pour chaque type d’entité (équipement, OT, etc.), lorsque l’utilisateur confirme « Supprimer » dans le panneau, appeler l’API DELETE correspondante, puis rediriger vers la liste et afficher un message de succès (ou gérer les cas où la suppression est interdite, ex. OT clôturé).

2. **Ajouter une confirmation avant suppression pour seuils et BOM**  
   Sur la fiche équipement, avant de supprimer un seuil ou une ligne de nomenclature : dialog MUI (ou équivalent) du type « Supprimer ce seuil ? » / « Retirer cette pièce de la nomenclature ? » avec boutons Annuler / Supprimer.

3. **Bouton « Nouvel équipement » (ou « Créer ») sur la page Liste équipements**  
   En haut de la page, à côté de « Carte hiérarchie », ajouter un bouton principal « Nouvel équipement » (ou « Créer » avec menu : Site, Ligne, Machine, etc.) qui mène vers la création machine (ou vers la page Création avec le type approprié). Réduire la dépendance au seul panneau d’actions.

4. **Avertissement avant perte de données**  
   Sur les écrans de formulaire longs (création / édition OT, équipement, pièce, etc.), ajouter un `beforeunload` (et éventuellement un garde de route React) pour afficher « Les modifications non enregistrées seront perdues. Quitter quand même ? » lorsque des champs ont été modifiés.

5. **Message explicite si aucun site n’existe**  
   Sur la page Création → Machine (et types hiérarchiques), si la liste des sites est vide, afficher une alerte ou un message du type : « Créez d’abord un site (menu Équipements → Création → Site) pour pouvoir ajouter une machine. » et désactiver le bouton Créer avec une explication.

### Réduire la confusion

6. **Unifier la création d’OT**  
   Choisir un seul parcours principal pour « Créer un OT » (soit toujours la page Création avec type « Ordre de travail », soit toujours le formulaire dédié `/app/work-orders/new`) et faire pointer tous les liens « Nouvel OT » / « Déclarer une panne » vers ce parcours. Depuis les plans de maintenance, garder le préremplissage (équipement, plan, titre) via l’état de navigation.

7. **Corriger les libellés du formulaire OT**  
   Remplacer « Declarer » / « Creer » / « Debut prevu » / « Fin prevue » par « Déclarer » / « Créer » / « Début prévu » / « Fin prévue » (et vérifier les autres écrans pour la cohérence).

8. **Remplacer `window.confirm` par des dialogs métier**  
   Pour les suppressions (et autres actions critiques), utiliser un `Dialog` MUI avec titre, texte explicatif (ex. « Cette catégorie sera supprimée. Les équipements qui y sont rattachés ne seront pas supprimés. ») et boutons « Annuler » / « Supprimer » (rouge). Même style partout.

9. **Rendre le panneau d’actions complémentaire, pas indispensable**  
   Pour les actions principales (Créer, Voir, Modifier), les dupliquer dans le contenu de la page (boutons en en-tête de liste ou en haut de fiche) pour que l’application reste utilisable même si le panneau est fermé ou peu vu.

10. **Clarifier statut vs workflow sur la fiche OT**  
    Afficher un libellé unique et compréhensible pour l’état de l’OT (ex. « Brouillon », « À planifier », « En cours », « Terminé ») et, si besoin, une courte aide au survol ou un lien « En savoir plus » pour les utilisateurs avancés. Adapter les libellés des boutons (ex. « Démarrer l’intervention », « Terminer l’intervention », « Clôturer l’OT ») pour qu’ils reflètent le métier.

---

*Document généré à partir de l’analyse du code et des parcours utilisateur (sans test manuel dans le navigateur). Pour valider en conditions réelles, lancer l’application (backend + frontend), se connecter et reproduire les scénarios : création équipement / OT, erreurs volontaires (champs vides, mauvais statuts), suppressions, rechargement et navigation.*
