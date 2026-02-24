# Pistes d'amélioration et d'enrichissement de la GMAO

Ce document propose des axes concrets pour rendre l'application plus **robuste** et **complète**, en s’appuyant sur l’existant (équipements, OT, planning, stock, effectif, multi-tenant, rapports, etc.).

---

## 1. Fonctionnalités métier à renforcer ou ajouter

### 1.1 Pointage et présence (déjà amorcé)
- **Présence** : tableau de présence par jour/semaine (présent / absent / congé / formation), plannings de poste, alertes absences.
- **Pointage** : enregistrement entrée/sortie (manuel ou via API), lien avec une **machine pointeuse** (lecteur badge, API REST ou fichier d’import), calcul des heures, export pour paie.
- **Données** : tables `presence_records`, `time_entries` (technicien_id, date, type entrée/sortie, source: manuel|pointeuse), paramétrage des plages horaires et seuils.

### 1.2 GMAO mobile / terrain
- **PWA** ou app mobile (React Native / Capacitor) : consultation et mise à jour des OT, checklists, saisie des compteurs, photo avant/après, signature client.
- **Mode hors-ligne** : cache des OT et checklists, file d’attente des actions, synchronisation au retour en ligne.
- **Notifications push** : rappels d’OT, alertes seuils, demandes d’intervention.

### 1.3 Maintenance prédictive et IoT
- **Seuils** (déjà en place) : exploiter davantage les seuils (compteurs, capteurs) pour générer des OT ou alertes automatiques.
- **Intégration capteurs** : API ou jobs pour récupérer des données externes (température, vibrations, heures de fonctionnement) et déclencher des règles (seuils, tendances).
- **Tableau de bord équipement** : courbes d’évolution des compteurs et indicateurs par équipement.

### 1.4 Gestion des pièces et stock avancée
- **Niveaux de stock par site/emplacement** : multi-sites déjà présents, étendre la logique stock (quantités par site, transferts inter-sites).
- **Réapprovisionnement** : règles de réappro (mini/maxi, point de commande), génération de bons de commande ou d’ordres d’achat.
- **Traçabilité** : lot / numéro de série sur les mouvements et sur les OT (pièces posées par OT).
- **Coûts** : coût unitaire moyen ou FIFO, coût des consommations par OT et par équipement (déjà partiellement en place dans les rapports).

### 1.5 OT et exécution
- **Templates d’OT** (déjà en place) : les généraliser (étapes, durées indicatives, pièces prévues, compétences requises).
- **OT récurrents** : génération automatique à partir de règles (périodicité, compteur, condition).
- **Saisie des temps** : temps passé par technicien par OT (déjà partiellement avec opérateurs), répartition par phase (diagnostic, réparation, essai).
- **Pièces consommées** : lier explicitement les sorties stock aux OT (ligne “pièce X, qté, OT”) pour coûts et historiques.
- **Validation / clôture** : workflow (brouillon → planifié → en cours → à valider → clôturé) avec droits par rôle.

### 1.6 Budget et coûts
- **Budgets** (déjà en place) : budgets par équipement, par site, par projet ; alertes dépassement.
- **Coûts réels** : synthèse main d’œuvre + pièces + sous-traitance + autres par OT / équipement / période (rapports à enrichir).
- **Prévisionnel** : coût prévisionnel des plans de maintenance et des projets.

### 1.7 Effectif et compétences
- **Plan de charge** : vue capacité / charge par technicien (OT assignés, formations, congés) pour le planning.
- **Affectation intelligente** : proposition d’affectation selon compétences, disponibilité, charge, proximité (si géoloc).
- **Formations** (catalogue et plans déjà là) : lien formation → compétence (habilitation), rappels échéances et renouvellements.

### 1.8 Sous-traitance et achats
- **Ordres de sous-traitance** : cycle de vie (création, envoi, réception, facturation) et lien avec les OT sous-traités.
- **Achats** : bons de commande fournisseurs, réception, mise en stock, rapprochement factures.
- **Contrats** : échéances, renouvellements, alertes (déjà partiellement avec contrats).

### 1.9 Conformité et traçabilité
- **Audit** (déjà en place) : étendre les événements audités (modifications paramétrage, exports, suppression d’OT).
- **Documents obligatoires** : par type d’équipement ou par site (rapports de vérification, consignes), alertes documents manquants ou expirés.
- **Réglementation** : champs ou modules dédiés (contrôles réglementaires, dates de prochain contrôle).

### 1.10 Tableaux de bord et rapports
- **KPIs** (déjà en place) : ajouter des indicateurs (taux de respect des délais, taux d’OT en retard, coût par heure de fonctionnement, OEE simplifié).
- **Rapports personnalisables** : filtres sauvegardés, rapports récurrents (planifiés par email).
- **Exports** : Excel/PDF déjà présents ; ajouter exports planifiés (stock, OT du mois, coûts) vers stockage ou SFTP.
- **Aide à la décision** (déjà en place) : enrichir avec recommandations (équipements à surveiller, plans à ajuster).

---

## 2. Robustesse technique

### 2.1 Performance
- **Pagination et filtres** : s’assurer que toutes les listes (OT, équipements, stock, techniciens) sont paginées côté API et que les filtres sont indexés (SQL).
- **Cache** : cache HTTP ou Redis pour données peu changeantes (référentiels, paramètres, listes déroulantes).
- **Requêtes lourdes** : optimiser les rapports (agrégations, vues matérialisées ou tables de synthèse mises à jour par jobs).
- **Frontend** : lazy loading des routes (déjà en place), virtualisation des longues listes, mémoisation des composants coûteux.

### 2.2 Sécurité
- **Authentification** : JWT avec refresh token, durée de session configurable, révocation de tokens.
- **Autorisations** : rôles déjà présents ; affiner les droits par ressource (ex. certains utilisateurs uniquement en lecture sur les équipements).
- **API** : rate limiting, validation stricte des entrées (express-validator déjà utilisé), pas d’exposition de stack traces en production.
- **Données sensibles** : chiffrement des champs sensibles si besoin (ex. données personnelles), logs sans mots de passe.

### 2.3 Fiabilité et disponibilité
- **Base de données** : sauvegardes automatiques (backup déjà exposé), stratégie de rétention, tests de restauration.
- **Multi-tenant** : isolation stricte des données par `tenant_id` sur toutes les requêtes (vérifier chaque route).
- **Jobs asynchrones** : file de jobs (ex. Bull/Redis) pour envoi d’emails, génération de rapports, synchronisation pointeuse, pour ne pas bloquer les requêtes.
- **Health check** : endpoint détaillé (DB, Redis si utilisé, espace disque) pour la supervision.

### 2.4 Qualité du code
- **Tests** : tests unitaires et d’intégration (Jest, Supertest) sur les routes critiques (auth, OT, stock, multi-tenant).
- **Migrations** : garder les migrations versionnées (déjà en place) et documentées ; pas de modification manuelle du schéma en prod.
- **Logs** : logs structurés (JSON) avec niveau, tenant_id, user_id, durée des requêtes ; corrélation avec l’audit.
- **Documentation API** : OpenAPI/Swagger pour faciliter l’intégration (mobile, pointeuse, IoT).

---

## 3. Expérience utilisateur (UX)

- **Recherche globale** (déjà en place) : étendre à d’autres entités (contrats, fournisseurs, procédures) et améliorer la pertinence.
- **Raccourcis et favoris** : menus épinglés (déjà en place) ; raccourcis clavier pour les écrans les plus utilisés.
- **Formulaires** : validation en temps réel, messages d’erreur clairs, sauvegarde brouillon pour les longs formulaires (OT, projets).
- **Accessibilité** : contraste, navigation clavier, labels ARIA (déjà Material-UI en partie).
- **Responsive** : s’assurer que les tableaux et le planning sont utilisables sur tablette (menu, filtres, cartes).
- **Onboarding** : guide rapide ou tutoriels pour les nouveaux utilisateurs (rôles par profil).

---

## 4. Intégrations

- **Machine pointeuse** : API REST ou import fichier (CSV/Excel) pour récupérer les pointages ; mapping badge → technicien.
- **Compteurs / IoT** : API ou fichiers pour alimenter les compteurs d’équipements et déclencher seuils.
- **Comptabilité / ERP** : export des coûts, des factures fournisseurs ou des écritures pour import dans un ERP.
- **Email / SMS** : templates déjà en place ; étendre les scénarios (OT créé, OT assigné, alerte stock, rappel formation).
- **SSO / LDAP** : authentification centralisée pour les entreprises qui le demandent.

---

## 5. Priorisation suggérée (roadmap)

| Priorité | Thème | Exemples d’actions |
|----------|--------|---------------------|
| **P1** | Robustesse multi-tenant & données | Audit isolation tenant sur toutes les routes ; sauvegardes et restauration testées. |
| **P1** | Pointage & présence | Modèle de données (presence, time_entries), écrans Présence et Pointage complets, API pointeuse ou import. |
| **P2** | OT & exécution | Pièces consommées liées aux OT ; temps par phase ; workflow de clôture. |
| **P2** | Stock avancé | Stock par site/emplacement ; traçabilité lot/série ; règles de réappro. |
| **P2** | Rapports & KPIs | Nouveaux indicateurs ; rapports planifiés ; exports automatiques. |
| **P3** | Mobile / terrain | PWA ou app ; mode hors-ligne léger ; notifications push. |
| **P3** | Prédictif / IoT | Exploitation avancée des seuils ; intégration données externes. |
| **P3** | Achats & sous-traitance | Cycle de vie des ordres ; lien OT ↔ facturation. |

---

## 6. Résumé

Pour une **GMAO robuste et complète**, il est utile de :

1. **Consolider l’existant** : multi-tenant, performances, sécurité, tests et sauvegardes.
2. **Compléter les briques déjà amorcées** : pointage/présence, rapports, coûts, pièces sur OT.
3. **Enrichir le cœur métier** : OT (workflow, temps, pièces), stock (sites, traçabilité, réappro), effectif (charge, compétences).
4. **Ouvrir l’écosystème** : mobile, pointeuse, IoT, ERP, SSO.

En partant de ce document, tu peux choisir un ou deux axes (par exemple **pointage/présence** et **pièces consommées sur OT**) pour les détailler en user stories et en tâches de développement.
