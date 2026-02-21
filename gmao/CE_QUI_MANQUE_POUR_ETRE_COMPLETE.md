# Ce qu’il manque dans l’application GMAO pour être complète

Ce document liste les **fonctionnalités, modules et points de maturité** manquants ou incomplets pour considérer l’application comme complète (production et usage GMAO au quotidien).

---

## 1. Fonctionnalités annoncées mais non implémentées

### 1.1 Stock — Inventaires physiques
- **État :** Page présente, API renvoie toujours `[]`.
- **Manque :**
  - Table en base (ex. `stock_inventories`, `stock_inventory_lines`).
  - Création d’un inventaire (date, responsable, statut brouillon/terminé).
  - Saisie des quantités comptées par pièce, calcul des écarts, validation et mise à jour du stock.
- **Impact :** Réconciliation stock réel / logiciel impossible sans cette boucle.

### 1.2 Stock — Réapprovisionnements
- **État :** Page présente, API renvoie toujours `[]`.
- **Manque :**
  - Table (ex. `reorder_requests` ou lien avec alertes stock).
  - Workflow : alerte stock → demande de réappro → commande fournisseur (lien avec `/suppliers/orders`).
- **Impact :** Pas de suivi des demandes d’achat ni de lien stock → commande.

### 1.3 Exports PDF (page Exports)
- **État :** Seuls les exports Excel (OT, rapport détaillé) sont branchés.
- **Manque :** Implémentation des exports PDF annoncés :
  - Liste des équipements
  - Plans de maintenance
  - État des stocks
  - Indicateurs (KPIs)
- **Impact :** Archiving / impression limités à l’Excel.

---

## 2. Fonctionnalités partielles ou à renforcer

### 2.1 Mouvements de stock (Entrées / Sorties / Transferts)
- **État :** Les listes affichent les mouvements ; la création se fait uniquement via la page **Création**.
- **Manque :**
  - Formulaire direct sur les pages Entrées, Sorties, Transferts (sans passer par Création).
  - Renseigner systématiquement `user_id` à la création du mouvement (traçabilité).
- **Impact :** Moins pratique pour les utilisateurs qui ne pensent pas à passer par Création.

### 2.2 Notifications / centre d’alertes
- **État :** API `/api/alerts` existe (table `alerts`, lecture, marquage lu).
- **Manque :**
  - Affichage dans le Layout (icône cloche, badge nombre non lus, liste ou page dédiée).
  - Création automatique d’alertes (ex. OT assigné, plan en retard, alerte stock).
- **Impact :** Les utilisateurs ne voient pas les alertes en temps réel.

### 2.3 Rapports
- **État :** Coûts par équipement et disponibilité existent ; exports Excel OK.
- **Manque :**
  - Période par défaut (ex. mois en cours) et filtres (site, équipement, type d’OT).
  - Rapport « Temps passé par technicien » (à partir des interventions).
  - Rapport « Pièces les plus utilisées » (pour achats / stock).
- **Impact :** Analyse et pilotage encore limités.

### 2.4 Ordres de travail (OT)
- **État :** Création, liste, détail, statuts, affectation, interventions, pièces utilisées.
- **Manque éventuel :**
  - Impression / PDF d’un OT (bon de travail pour le technicien).
  - Signature ou validation de fin d’intervention (traçabilité).
  - Champs dates planifiées (début/fin) bien visibles et éditables partout.
- **Impact :** Confort terrain et conformité selon les process.

### 2.5 Équipements
- **État :** Liste, fiche, hiérarchie, catégories, fiches techniques, historique, documents, garanties.
- **Manque éventuel :**
  - Nomenclature / BOM (liste de pièces par équipement pour planifier les stocks).
  - Lien pièce ↔ équipement (quelles pièces pour quel équipement).
- **Impact :** Gestion des pièces critiques et des stocks ciblés.

---

## 3. Paramétrage et données de référence

### 3.1 Déjà en place
- Codification (préfixe + longueur par type).
- Taux horaire (coûts).
- Codes défaut.
- Rôles et permissions.
- Sites, départements, lignes.

### 3.2 À compléter si besoin
- **Unités de mesure** (pièces) : actuellement texte libre ; liste prédéfinie (unité, kg, L, m, etc.) possible.
- **Types de mouvement** : aujourd’hui in/out/transfer/adjustment ; extension possible (retour, perte, etc.).
- **Types d’OT** : gérés ; vérifier que les libellés et usages (préventif / correctif) sont cohérents partout.

---

## 4. Sécurité et environnement de production

### 4.1 Sécurité
- **Authentification :** En place (JWT, login).
- **Autorisations :** Rôles (admin, responsable, technicien, etc.) et `authorize()` sur les routes sensibles.
- **Manque possible :**
  - Rate limiting sur login et API (éviter brute force).
  - Politique de mot de passe (complexité, expiration) et réinitialisation (lien par email).
  - Logs d’audit (qui a créé/modifié/supprimé quoi et quand) pour les entités critiques (OT, équipements, stock, utilisateurs).

### 4.2 Production
- **Base de données :** SQLite (fichier) ; pas de sauvegarde automatique ni de procédure de restauration.
- **Manque :**
  - Sauvegardes automatiques (copie du fichier .db ou export).
  - Documentation déploiement (variables d’environnement, HTTPS, reverse proxy).
  - Health check (déjà `/api/health`) ; optionnel : vérification de la connexion DB.

---

## 5. Expérience utilisateur (UX) et robustesse

### 5.1 UX
- **Manque possible :**
  - Fil d’Ariane (breadcrumbs) sur les pages imbriquées (ex. Équipement > Fiche > Historique).
  - Messages de succès / erreur homogènes (toast ou snackbar global).
  - États de chargement et messages « Aucune donnée » cohérents sur toutes les listes.
  - Raccourcis ou liens « Retour » explicites (déjà partiellement présents).

### 5.2 Gestion d’erreurs
- **API :** Erreurs renvoyées en JSON ; à vérifier que le front affiche toujours un message lisible (pas de page blanche ou erreur technique brute).
- **Connexion perdue :** Pas de détection « session expirée » ou « serveur injoignable » avec redirection login ou message clair.

### 5.3 Internationalisation (i18n)
- **État :** Textes en français en dur.
- **Manque :** Pas de couche i18n ; si multi-langue requis plus tard, il faudra introduire des clés de traduction (ex. react-i18next).

---

## 6. Synthèse par priorité

| Priorité | Élément | Effort estimé | Impact |
|----------|--------|--------------|--------|
| Haute    | Inventaires stock (table + workflow) | Moyen | Completude stock |
| Haute    | Réapprovisionnements (table + lien commandes) | Moyen | Boucle stock → achat |
| Haute    | Notifications visibles dans l’UI (cloche + liste) | Faible | Utilisation des alertes |
| Moyenne  | Formulaire Entrées/Sorties/Transferts sur les pages dédiées | Faible | Confort utilisateur |
| Moyenne  | Traçabilité `user_id` sur tous les mouvements de stock | Faible | Audit |
| Moyenne  | Exports PDF (équipements, plans, stocks, KPIs) | Moyen | Archivage / impression |
| Moyenne  | Sauvegardes base de données | Faible | Production |
| Basse   | BOM / nomenclature par équipement | Moyen | Gestion pièces |
| Basse   | Impression OT (bon de travail PDF) | Faible | Terrain |
| Basse   | Audit log (qui a modifié quoi) | Moyen | Conformité |
| Basse   | Rate limiting + politique mot de passe | Faible | Sécurité |

---

## 7. Conclusion

Pour considérer l’application **complète** au sens GMAO opérationnelle :

1. **Indispensable :** Inventaires stock, réapprovisionnements (ou retrait des entrées menu si non prévus), et visibilité des notifications dans l’interface.
2. **Recommandé :** Formulaires stock directs, traçabilité utilisateur sur les mouvements, exports PDF annoncés, sauvegardes DB.
3. **Selon besoin métier :** BOM équipements, impression OT, audit log, renforcement sécurité et déploiement.

En complétant au moins les points « Indispensable » et une partie des « Recommandé », l’application couvrira les boucles métier principales (équipements, OT, stock, fournisseurs, planning, rapports) et sera exploitable en production avec un niveau de confiance suffisant.
