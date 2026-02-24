# Comparaison avec les grandes GMAO / EAM et propositions d’implémentation

Ce document compare la GMAO actuelle aux solutions **enterprise** (IBM Maximo, SAP PM, Infor EAM, Coswin / Siveco, Mainsim, etc.) et propose des **implémentations ou améliorations** concrètes pour s’en rapprocher.

---

## 1. Référentiel des grandes GMAO / EAM

Les solutions type **Maximo**, **SAP PM**, **Infor EAM**, **Coswin** partagent en général :

| Domaine | Fonctionnalités typiques |
|--------|---------------------------|
| **Actifs / équipements** | Registre central, hiérarchie physique (site → ligne → équipement → composant), fiches techniques, historique, coûts par actif, arborescences multiples (localisation, fonction, réseau). |
| **Ordres de travail** | Cycle de vie complet (création → validation → planification → exécution → clôture), approbations selon montant/type, templates, OT récurrents (temps/compteur/condition), temps par phase, pièces et main d’œuvre tracées. |
| **Maintenance préventive** | Plans basés sur le temps ou les compteurs, génération automatique d’OT, échéancier, rappels. |
| **Maintenance prédictive / IoT** | Connexion capteurs, seuils, alertes, tableaux de bord actifs, tendances. |
| **Stock & achats** | Stock multi-sites/emplacements, lots et numéros de série, réappro (mini/maxi, point de commande), bons de commande, réception, facturation. |
| **Effectif & compétences** | Plan de charge, certifications/habilitations, affectation selon compétences et charge, formations et renouvellements. |
| **Sous-traitance** | Ordres sous-traités, cycle vie (création → envoi → réception → facturation), lien avec les OT. |
| **Rapports & KPIs** | Tableaux de bord, KPIs (disponibilité, MTBF, MTTR, coûts, OEE), rapports planifiés, exports, aide à la décision. |
| **Conformité** | Documents obligatoires par actif/site, contrôles réglementaires, audit étendu, traçabilité. |
| **Mobile / terrain** | App ou PWA, hors-ligne, saisie OT/checklists, photos, signature client, notifications push. |
| **Intégrations** | ERP, compta, pointeuse, IoT, SSO/LDAP, API documentées. |

---

## 2. Comparatif : Notre GMAO vs grandes solutions

| Module / thème | Grandes GMAO | Notre GMAO | Écart | Implémentation ou amélioration proposée |
|----------------|--------------|------------|--------|----------------------------------------|
| **Registre actifs** | Registre central, hiérarchie, coûts par actif | ✅ Hiérarchie site/ligne/équipement, BOM, compteurs, garanties | Partiel | **Coût total par actif** : synthèse main d’œuvre + pièces + sous-traitance sur vie de l’actif ; **fiche actif** avec onglet « Coûts / Historique ». |
| **Arborescence actifs** | Plusieurs vues (physique, fonction, réseau) | ✅ Une arborescence (carte hiérarchie) | Partiel | **Optionnel** : 2e type d’arborescence (ex. « par fonction ») avec lien équipement ↔ nœud fonction. |
| **Cycle de vie OT** | Création → validation → planification → exécution → clôture, approbations | ✅ Workflow brouillon → planifié → en cours → à valider → clôturé ; rôles | Bon | **Approbation selon montant** : si coût estimé > seuil (paramétrable), passage par étape « À approuver » avec validation responsable. |
| **OT récurrents** | Génération auto (calendrier, compteur, condition) | ✅ Plans de maintenance → exécution OT | Partiel | **Génération par compteur** : règle « tous les X heures de fonctionnement » ; job qui crée l’OT quand le compteur dépasse le seuil. |
| **Temps par phase** | Diagnostic / réparation / essai (ou équivalent) | ✅ Table `work_order_phase_times` ; API partielle | Partiel | **UI complète** : saisie temps par phase sur fiche OT, synthèse et inclusion dans le coût main d’œuvre. |
| **Pièces sur OT** | Pièces consommées + réservations, traçabilité | ✅ Pièces consommées (table dédiée), réservations, coût | Bon | **Lot / n° de série** sur les lignes consommées (optionnel) ; **réappro** lié (point de commande quand stock < seuil). |
| **Maintenance préventive** | Plans temps + compteur, échéancier, rappels | ✅ Plans, échéances, OT générés | Bon | **Rappels** : notification X jours avant échéance ; **plan par compteur** (déclencher à X heures). |
| **Prédictif / IoT** | Capteurs, seuils, alertes, dashboards actifs | ✅ Seuils sur compteurs ; alertes basiques | Partiel | **Job seuils** : si dépassement → alerte + option « Créer OT » ; **courbe compteur** sur fiche équipement. |
| **Stock** | Multi-sites, lots/séries, réappro, BC, réception | ✅ Stock central, mouvements, réservations | Partiel | **Stock par site/emplacement** ; **lot / n° de série** sur mouvements ; **règles réappro** (mini/maxi, point de commande) ; **bon de commande** (création, réception, lien stock). |
| **Effectif** | Plan de charge, compétences, affectation intelligente | ✅ Techniciens, compétences, équipes, pointage/présence | Partiel | **Plan de charge** : vue « charge vs capacité » par technicien (OT + formations + absences) ; **suggestion d’affectation** (déjà partielle) : prendre en compte charge et disponibilité. |
| **Sous-traitance** | Cycle vie ordre, réception, facturation, lien OT | ✅ Sous-traitants, ordres ; lien OT partiel | Partiel | **Workflow ordre** : brouillon → envoyé → en cours → réceptionné → facturé ; **lien OT** : choix « OT sous-traité » sur l’OT, montant et facturation. |
| **Budget & coûts** | Budgets par actif/site/projet, alertes dépassement | ✅ Budgets, coûts OT (main, pièces, frais) | Partiel | **Alertes dépassement** : seuil par budget (%), notification quand dépassement ; **prévisionnel** : coût prévu des plans + projets sur la période. |
| **Rapports & KPIs** | Dashboards, MTBF/MTTR, OEE, rapports planifiés | ✅ KPIs, rapports coûts/dispo/MTBF/MTTR, exports | Partiel | **Rapports planifiés** : envoi email (quotidien/hebdo/mensuel) avec rapport configuré ; **OEE simplifié** (dispo × perf × qualité si données dispo) ; **filtres sauvegardés**. |
| **Conformité** | Documents obligatoires, contrôles réglementaires | ✅ Audit log, documents équipement | Partiel | **Documents obligatoires** : par type d’équipement ou site (liste de types requis) ; **alerte document manquant / expiré** ; **contrôles réglementaires** : date prochain contrôle, rappel. |
| **Mobile / terrain** | App, hors-ligne, photos, signature | ❌ Web uniquement | Fort | **PWA** : installable, responsive ; **cache OT/checklists** pour usage dégradé ; **notifications push** ; plus tard : **hors-ligne** avec file de synchronisation. |
| **Demandes d’intervention** | Portail, workflow validation, numérotation | ✅ Demandes, validation, création OT, numéro (codification) | Bon | **Portail public** (optionnel) : formulaire sans login pour déclarer une demande (avec captcha / modération). |
| **Pointage / présence** | Intégration pointeuse, heures, export paie | ✅ Présence, pointage (manuel), API | Partiel | **Import pointeuse** : CSV/Excel ou API ; **export heures** (paie) : synthèse par technicien et période. |
| **Multi-tenant** | Souvent par instance ou séparation stricte | ✅ Multi-tenant, bases client, licence | Bon | Conserver ; **audit isolation** sur toutes les routes. |
| **API & intégrations** | API complètes, SSO, ERP, IoT | ✅ API REST, pas de SSO/OpenAPI | Partiel | **OpenAPI/Swagger** ; **SSO/LDAP** (optionnel) ; **export ERP** (coûts, écritures). |

---

## 3. Propositions d’implémentation priorisées

En s’appuyant sur les écarts ci-dessus et sur le coût/effort, ordre recommandé :

### Niveau 1 – Impact fort, effort modéré

| # | Sujet | Détail technique / fonctionnel |
|---|--------|--------------------------------|
| 1 | **Alertes dépassement budget** | Seuil % par budget (paramétrage) ; job ou vérif à la clôture d’OT / ajout coût ; notification (email/alerte in-app) aux responsables. |
| 2 | **Rapports planifiés** | Paramétrage : type de rapport (ex. coûts du mois), fréquence (jour/semaine/mois), destinataires ; job cron qui génère et envoie par email (template existant). |
| 3 | **Temps par phase (OT)** | Utiliser `work_order_phase_times` ; sur fiche OT : section « Temps par phase » (diagnostic, réparation, essai) avec saisie heures + inclusion dans coût main d’œuvre. |
| 4 | **Approbation OT selon montant** | Paramètre « Seuil approbation (€) » ; statut « à_approbation » si coût estimé ou réel > seuil ; bouton « Approuver » pour responsable ; puis passage en cours / clôture. |
| 5 | **Import pointages (pointeuse)** | Route `POST /api/time-entries/import` : fichier CSV (technicien_id ou badge, date, heure, type in/out) ; mapping badge → technicien en paramétrage. |

### Niveau 2 – Fonctionnel avancé

| # | Sujet | Détail |
|---|--------|--------|
| 6 | **Stock par site/emplacement** | Table `stock_by_location` (site_id ou location_id, spare_part_id, quantity) ; mouvements et réservations avec emplacement ; transferts inter-sites. |
| 7 | **Génération OT par compteur** | Règle sur plan (ou nouvelle entité) : « Créer OT tous les X heures » ; job quotidien : lecture compteurs, comparaison à seuil, création OT si dépassement. |
| 8 | **Plan de charge effectif** | Vue (écran ou widget) : par technicien, charge (heures OT assignés + formations + absences) vs capacité (heures dispo) ; filtres par période. |
| 9 | **Documents obligatoires** | Référentiel « Types de documents obligatoires » par type d’équipement (ou site) ; sur fiche équipement, liste requise vs renseignée ; alerte « manquant / expiré ». |
| 10 | **Workflow ordres sous-traitance** | Statuts ordre : brouillon, envoyé, en cours, réceptionné, facturé ; champs date réception, montant facturé ; lien explicite OT ↔ ordre sous-traitance. |

### Niveau 3 – Différenciation « type grande GMAO »

| # | Sujet | Détail |
|---|--------|--------|
| 11 | **Courbes compteurs / équipement** | Sur fiche équipement : graphique évolution des compteurs dans le temps (API + front avec lib type Chart.js / Recharts). |
| 12 | **Job seuils → alerte + option OT** | Si dépassement seuil (compteur ou condition) : créer alerte + action « Créer OT » (template ou type d’OT paramétrable). |
| 13 | **Coût total par actif** | Requête agrégée : somme (main d’œuvre + pièces + sous-traitance) par équipement (toute la vie) ; affichage dans fiche équipement + rapport. |
| 14 | **PWA + notifications push** | Manifest PWA, Service Worker, option « Installer l’app » ; abonnement push (Web Push) pour rappels OT et alertes. |
| 15 | **OpenAPI / Swagger** | Génération ou rédaction du spec OpenAPI 3 pour les routes principales ; UI Swagger pour tester et documenter les intégrations. |

---

## 4. Synthèse

- **Points déjà alignés** avec les grandes GMAO : hiérarchie actifs, OT avec workflow et pièces consommées, plans de maintenance, demandes d’intervention numérotées, stock de base, effectif et compétences, pointage/présence, multi-tenant, rapports de base.
- **Principaux écarts** : rapports planifiés, alertes budget, approbation OT selon montant, temps par phase complet, stock multi-sites et réappro, plan de charge, mobile/PWA, conformité documents, intégration pointeuse et IoT.
- **Ordre conseillé** : traiter d’abord **alertes budget**, **rapports planifiés**, **temps par phase** et **import pointeuse** ; puis **stock par site**, **plan de charge** et **documents obligatoires** ; enfin **PWA**, **OpenAPI** et **courbes compteurs** pour se rapprocher encore du niveau des grandes solutions.

Ce document peut être utilisé comme **backlog** en le reliant à `GMAO_ROADMAP_AMELIORATIONS.md` pour les détails techniques et la priorisation globale.

---

## 5. Implémentation réalisée (référence technique)

| # | Fonctionnalité | Backend | Frontend / Usage |
|---|----------------|---------|-------------------|
| 1 | Alertes dépassement budget | `app_settings.budget_alert_threshold_percent`, `budgets.js` (checkBudgetOverrun), notificationService `budget_overrun`, alertes in-app | Paramétrage : GET/POST `/api/settings/budget-alert-threshold` |
| 2 | Rapports planifiés | Table `scheduled_reports`, `scheduledReports.js`, job horaire (runScheduledReports par tenant), envoi email | GET/POST/PUT/DELETE `/api/scheduled-reports`, GET `/api/scheduled-reports/types` |
| 3 | Temps par phase OT | `work_order_phase_times` (migration 039), getWorkOrderCosts inclut les heures phase, GET/POST `/api/work-orders/:id/phase-times` | Saisie temps par phase sur fiche OT (diagnostic, réparation, essai) |
| 4 | Approbation OT selon montant | `app_settings.approval_threshold_amount`, statut `pending_approval`, PUT `/api/work-orders/:id/approve` | Paramétrage : GET/POST `/api/settings/approval-threshold-amount` ; bouton Approuver sur fiche OT |
| 5 | Import pointages pointeuse | Table `technician_badges`, POST `/api/time-entries/import` (CSV/JSON), GET/POST/DELETE `/api/time-entries/badges` | Import fichier ou body JSON avec badgeCode/technicianId |
| 6 | Stock par site | Migration `054_stock_by_site`, `stockBySite.js` : GET `/api/stock-by-site`, GET `/api/stock-by-site/summary`, PUT `/:siteId/:sparePartId` | Écrans stock par site à brancher sur l’API |
| 7 | Génération OT par compteur | Plans `trigger_type=counter`, `threshold_value` ; job horaire `scheduledJobs.runCounterBasedPlanGeneration` crée l’OT et met à jour le plan | Plans de maintenance avec déclenchement « compteur » |
| 8 | Plan de charge effectif | GET `/api/planning/workload` (charge heures OT vs capacité par technicien) | Vue plan de charge à brancher |
| 9 | Documents obligatoires | Migration `055_required_document_types`, `requiredDocumentTypes.js` : CRUD + GET `/check?equipmentId=|siteId=` | Référentiel par type équipement/site ; vérification manquants/expirés |
| 10 | Workflow ordres sous-traitance | Table `subcontract_orders` avec statuts (draft, sent, in_progress, completed, cancelled, invoiced) déjà en place | Utiliser les statuts existants côté UI |
| 11 | Courbes compteurs équipement | Migration `053_equipment_counter_history`, GET/POST `/api/equipment/:id/counter-history` ; enregistrement historique dans PUT `/api/equipment/:id/counters` | Graphique évolution compteur sur fiche équipement |
| 12 | Job seuils → alerte + option OT | `equipment_thresholds.create_wo_on_breach`, job horaire `scheduledJobs.runThresholdAlerts` (alerte + création OT si activé) | Paramétrage seuils sur fiche équipement |
| 13 | Coût total par actif | GET `/api/equipment/:id/total-cost` (main d’œuvre + pièces + frais + sous-traitance) | Fiche équipement + rapports |
| 14 | PWA + notifications push | `manifest.json`, `sw.js` (déjà présents), meta mobile-web-app | Installable ; push à brancher (Web Push) si besoin |
| 15 | OpenAPI / Swagger | Fichier `backend/src/openapi.json`, GET `/api/openapi.json` | Intégration Swagger UI optionnelle (URL spec) |
