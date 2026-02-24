# Audit production – GMAO Web (Node.js + React + SQLite)

**Date :** Février 2025  
**Périmètre :** Backend (Express), Base SQLite (multi-tenant), Frontend (React/Vite), lien Front/Back, sécurité, robustesse, préparation production.

---

## 1. Ce qui est fiable et prêt

### Backend – Node.js & API REST
- **Structure** : Routes (`/api/*`), services (audit, notification, codification, scheduledJobs), DB centralisée (`db.js`, `init.js`, migrations).
- **Cohérence REST** : Verbes HTTP corrects (GET/POST/PUT/DELETE), statuts 200/201/204/400/404/500, payloads JSON.
- **Gestion des erreurs** : Middleware global 4 arguments dans `server.js` : 404 et 500 renvoyés en JSON ; CORS et `Content-Type: application/json` sur `/api`.
- **Authentification / autorisation** : JWT (`authenticate`), rôles (`authorize(ROLES.ADMIN, …)`), licence tenant (dates start/end), base client par tenant.
- **Routes utilisées par le frontend** : Dashboard (kpis, charts, alerts, recent, …), equipment, work-orders, stock, suppliers, sites/lignes/departements, maintenance-plans, maintenance-projects, planning, intervention-requests, documents, alerts, checklists, tools, technicians, competencies, reports, settings, audit, budgets, procedures, failure-codes, exploitation, part-families/categories/sub-families, work-order-templates, training-catalog/plans, external-contractors, subcontract-orders, root-causes, satisfaction, time-entries, presence, attendance-overrides, users, stock-reservations, etc. Pas de doublon de montage de routes.

### Base de données – SQLite
- **Schéma** : `PRAGMA foreign_keys = ON`, clés primaires et étrangères sur les tables principales (users→roles, work_orders→equipment/users, interventions→work_orders, stock_balance→spare_parts, etc.), CHECK sur statuts (equipment.status, work_orders.status, stock_movements.movement_type).
- **Migrations** : Admin (gmao.db) : migrations exécutées au démarrage ; client : 043–056 appliquées à l’ouverture de chaque base client (`runClientMigrations` dans `db.js`).
- **Intégrité** : Types cohérents (INTEGER, TEXT, REAL, DATETIME). Suppression équipement : vérification des OT et plans de maintenance avant DELETE ; OT : soft delete (status → cancelled).

### Logique métier GMAO
- **Cycle équipement → OT → intervention → clôture** : Création OT (POST /work-orders), mise à jour statut (PUT /:id), clôture réservée aux rôles responsable/administrateur, calcul des coûts (main-d’œuvre, pièces, réservations, frais annexes) via `getWorkOrderCosts`.
- **Réservations OT** : Vérification du stock disponible (quantity_accepted ou quantity) avant ajout d’une réservation ; message d’erreur explicite si stock insuffisant.
- **Consommation pièces (OT)** : Vérification du stock avant sortie si `createStockExit === true` ; `deductStockOut` dans `stock.js` vérifie le stock accepté.
- **Statuts** : Cohérence des statuts OT (pending, in_progress, completed, cancelled, deferred) et équipement (operational, maintenance, out_of_service, retired).

### Frontend – React (JSX) + Vite
- **Structure** : Pages par domaine (maintenance, equipment, stock, settings, …), `api.js` central (axios, baseURL `/api`), Layout et menus cohérents.
- **Appels API** : Un seul client axios ; pas d’URL en dur ; token `xmaint-token` ; intercepteur 401 → déconnexion + redirection login ; 403 licence → redirection + message optionnel.
- **Formulaires** : WorkOrderForm, Creation, etc. : champs requis (ex. titre), feedback erreur (Alert/snackbar), loading au submit.
- **Build** : `npm run build` (Vite) configuré ; proxy `/api` vers backend en dev.

### Lien Frontend ↔ Backend
- **Écrans principaux** : Dashboard, listes OT/équipements/stock, détail OT, formulaire OT, planning, rapports, paramètres, alertes, documents, etc. appellent les bons endpoints. Données listes/détails cohérentes avec les réponses API.

### Sécurité
- **Validation côté serveur** : express-validator sur les routes sensibles (body, param) ; existence des ressources (OT, équipement, etc.) avant modification/suppression.
- **Rôles** : Clôture OT et approbation limitées aux rôles autorisés ; pas de confiance exclusive au frontend pour les actions critiques.

### Préparation production
- **Variables d’environnement** : Backend : `.env.example` (NODE_ENV, PORT, JWT_SECRET, DATABASE_PATH, SMTP, Twilio). Frontend : `vite.config.js` utilise `VITE_API_PORT` ou `PORT` pour le proxy (dev).
- **Démarrage** : `db.init()` au démarrage, schéma admin et migrations admin exécutés, jobs planifiés (rapports, seuils/compteurs) sur les bases client.

---

## 2. Problèmes classés par gravité

### Critique
| # | Problème | Fichier / zone |
|---|----------|----------------|
| C1 | **JWT_SECRET par défaut** : En production, si `JWT_SECRET` n’est pas défini, le code utilise une clé fixe (`auth.js`). Risque de forgery de tokens. | `gmao/backend/src/middleware/auth.js` |

### Haute
| # | Problème | Fichier / zone |
|---|----------|----------------|
| H1 | **Réservations stock (stock_reservations)** : `POST /api/stock-reservations` ne vérifie pas le stock disponible avant d’insérer. On peut réserver plus que le stock. | `gmao/backend/src/routes/stockReservations.js` |
| H2 | **Incohérence .env backend** : `.env.example` utilise `DATABASE_PATH=./data/xmaint.db` alors que `db.js` lit `GMAO_DB_PATH` (défaut `gmao.db`). Risque de confusion au déploiement. | `gmao/backend/.env.example`, `gmao/backend/src/database/db.js` |

### Moyenne
| # | Problème | Fichier / zone |
|---|----------|----------------|
| M1 | **Validation paramètre `:id`** : Plusieurs GET `/:id` (ex. work-orders, equipment) utilisent `param('id').isInt()` sans appeler `validationResult(req)`. Un `id` invalide (ex. "abc") peut donner 404 ou comportement inattendu au lieu d’un 400. | `gmao/backend/src/routes/workOrders.js`, `equipment.js`, etc. |
| M2 | **Feedback erreur listes frontend** : Plusieurs listes (ex. EquipmentList, WorkOrderList) utilisent `.catch(console.error)` ou `.catch(() => navigate(...))` sans message utilisateur (snackbar/Alert) en cas d’échec du chargement. | `gmao/frontend/src/pages/equipment/EquipmentList.jsx`, `maintenance/WorkOrderList.jsx`, etc. |
| M3 | **403 générique** : L’intercepteur axios ne gère que les 403 avec code licence (LICENSE_EXPIRED, etc.). Un 403 “permissions insuffisantes” n’entraîne ni redirection ni message. | `gmao/frontend/src/services/api.js` |
| M4 | **Pas de .env.example frontend** : Aucun fichier listant `VITE_API_PORT` (ou équivalent) pour le build/proxy, ce qui peut compliquer le déploiement. | `gmao/frontend/` |
| M5 | **Équipement hors service** : Aucune règle métier qui interdise la création d’un OT sur un équipement en `out_of_service` ou `retired`. Acceptable en choix métier mais à documenter ou rendre optionnel (warning). | `gmao/backend/src/routes/workOrders.js` (POST) |

### Basse
| # | Problème | Fichier / zone |
|---|----------|----------------|
| B1 | **Routes sans usage frontend** : `required-document-types`, `scheduled-reports`, `stock-by-site` ne sont pas appelées par le frontend. Backend prêt pour usage futur ou intégration externe. | Backend uniquement |
| B2 | **Schéma SQLite** : Aucun `ON DELETE` / `ON UPDATE` dans les REFERENCES du schéma initial. Comportement par défaut (ABORT) ; pas de cascade explicite. | `gmao/backend/src/database/init.js` |
| B3 | **stock_movements.work_order_id** : Pas de REFERENCES vers `work_orders(id)` dans init (colonne optionnelle). Pas bloquant pour l’intégrité actuelle. | `gmao/backend/src/database/init.js` |

---

## 3. Corrections précises (code ou logique)

### C1 – JWT_SECRET en production
- **Action** : En production, définir obligatoirement `JWT_SECRET` dans l’environnement (long, aléatoire). Optionnel : en dev, afficher un avertissement si on utilise la valeur par défaut.
- **Exemple** : Dans `auth.js`, ajouter en tête :  
  `if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'xmaint-jwt-secret-change-in-production')) { console.warn('⚠️ JWT_SECRET doit être défini en production'); }`

### H1 – Vérifier le stock avant création d’une réservation (stock_reservations)
- **Fichier** : `gmao/backend/src/routes/stockReservations.js`
- **Action** : Avant `INSERT INTO stock_reservations`, lire le stock disponible (comme dans `workOrders.js` pour work_order_reservations) : `stock_balance.quantity_accepted` ou `quantity`. Si disponible < quantité demandée (en tenant compte des réservations existantes pour la même pièce si besoin), retourner `400` avec message explicite.
- **Implémenté** : Voir correction appliquée ci-dessous.

### H2 – Aligner .env.example avec db.js
- **Fichier** : `gmao/backend/.env.example`
- **Action** : Remplacer `DATABASE_PATH=./data/xmaint.db` par `GMAO_DB_PATH=gmao.db` (ou indiquer que le chemin est relatif à `backend/data` selon la logique réelle de `db.js`), et documenter que le fichier final de la base admin est dans `data/` avec ce nom.

### M1 – Validation explicite de `:id` sur les GET ✅ Implémenté
- **Fichier** : `gmao/backend/src/routes/workOrders.js`, `gmao/backend/src/routes/equipment.js`
- **Action** : Helper `validateIdParam(req, res)` ajouté ; appel `if (validateIdParam(req, res)) return;` au début de chaque GET `/:id` et GET `/:id/...` utilisant `param('id').isInt()`.

### M2 – Feedback erreur listes ✅ Implémenté
- **Fichiers** : `EquipmentList.jsx`, `WorkOrderList.jsx`
- **Action** : État `loadError` + `snackbar.showError()` dans le `.catch()` du chargement ; `Alert` affichée en haut de la liste avec message d’erreur et bouton fermer.

### M3 – 403 générique ✅ Implémenté
- **Fichiers** : `gmao/frontend/src/services/api.js`, `gmao/frontend/src/context/SnackbarContext.jsx`
- **Action** : En cas de 403 sans code licence, dispatch d’un événement personnalisé `api-403` ; `SnackbarProvider` écoute cet événement et affiche un snackbar avec le message (data.error ou “Accès refusé - permissions insuffisantes”).

### M4 – .env.example frontend
- **Action** : Créer `gmao/frontend/.env.example` avec une ligne du type :  
  `# Port de l’API en dev (proxy). Optionnel.`  
  `# VITE_API_PORT=5000`

### M5 – Équipement hors service ✅ Implémenté
- **Fichier** : `gmao/backend/src/routes/workOrders.js`
- **Action** : POST /work-orders : si `equipmentId` est renseigné, vérification du statut équipement ; si `out_of_service` ou `retired`, retour 400 avec message explicite. PUT /:id : si `equipmentId` est modifié, même vérification avant mise à jour.

---

## 4. Robustesse & performance (recommandations)

- **SQLite** : Les requêtes listées (work_orders, equipment, stock_balance, JOINs) sont raisonnables. Les index existants (idx_work_orders_status, idx_equipment_status, etc.) sont cohérents. En charge forte, surveiller les requêtes sans index (ex. filtres sur champs non indexés).
- **API** : Éviter les appels en boucle côté frontend ; les `Promise.all` déjà utilisés (Dashboard, WorkOrderDetail) sont adaptés.
- **React** : Pas de re-renders massifs identifiés ; déduplication des listes dans l’intercepteur axios limite les doublons d’affichage.

---

## 5. Check-list finale de déploiement

Voir le fichier **`docs/CHECKLIST_DEPLOIEMENT.md`** (créé en parallèle).

---

## 6. Verdict

| Verdict | Signification |
|---------|----------------|
| **QUASI PRÊT** | L’application est exploitable en production après traitement des points **critiques** et **hauts** : sécuriser le JWT, corriger la vérification du stock pour les réservations (stock_reservations), et aligner la configuration (.env / GMAO_DB_PATH). Les points **moyens** améliorent la robustesse et l’UX ; les **bas** sont optionnels ou évolutifs. |

**Résumé** :  
- **PRÊT** : Non, sans correction de C1 et H1 (et recommandation H2).  
- **QUASI PRÊT** : Oui, après C1, H1, H2 et déploiement avec variables d’environnement correctes et check-list respectée.  
- **NON PRÊT** : Non ; la base (structure, auth, logique métier, intégrité) est solide.

---

*Document généré dans le cadre de l’audit senior full-stack GMAO.*
