# Spécification complète GMAO — Application de Gestion de Maintenance Assistée par Ordinateur

**Version :** 1.0  
**Date :** 2025  
**Statut :** Document de référence pour développement

---

# 1️⃣ ANALYSE MÉTIER GMAO

## 1.1 Processus métier — Maintenance corrective

### Chaîne complète : Déclaration → Validation → OT → Intervention → Clôture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  DÉCLARATION    │ →  │  VALIDATION     │ →  │ ORDRE DE        │ →  │ INTERVENTION    │ →  │  CLÔTURE        │
│  DE PANNE       │    │  (Responsable)  │    │ TRAVAIL (OT)    │    │ (Technicien)    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
     │                          │                       │                       │                       │
     │ • Source : utilisateur   │ • Accepter/Refuser   │ • Planification       │ • Début réel          │ • Validation
     │ • Équipement impacté    │ • Priorisation       │ • Affectation         │ • Pièces utilisées    │ • TDR (Temps
     │ • Symptômes             │ • Escalade si besoin │ technicien            │ • Fin réelle          │   de Réparation)
     │ • Gravité perçue        │                      │                       │ • Commentaires        │ • Coûts
     └─────────────────────────┴──────────────────────┴───────────────────────┴───────────────────────┴────────────────
```

| Étape | Acteur(s) | Actions | Statuts |
|-------|-----------|---------|---------|
| **1. Déclaration** | Opérateur, Utilisateur, Technicien | Saisie panne (équipement, description, photos optionnelles) | `déclaré` |
| **2. Validation** | Responsable maintenance | Vérification, priorisation, création OT ou rejet | `validé` / `rejeté` |
| **3. Ordre de travail** | Responsable, Planificateur | Affectation, planification, ressources | `planifié`, `affecté` |
| **4. Intervention** | Technicien | Exécution, consommations, temps passé | `en_cours`, `en_attente_pièce` |
| **5. Clôture** | Technicien + Responsable | Validation finale, enregistrement TDR, coûts | `clôturé` |

### Règles de gestion — Maintenance corrective

- **Priorités** : `low` (72h), `medium` (24h), `high` (8h), `critical` (2h) — SLA basé sur délai de prise en charge
- **Criticité équipement** : A (production), B (support), C (secondaire) — impacte priorisation automatique
- **Escalade** : Si OT `critical` non démarré dans le SLA → alerte responsable + notification
- **Double validation** : Clôture technique (technicien) + validation responsable pour OT > seuil coût

---

## 1.2 Processus métier — Maintenance préventive

### Types de maintenance préventive

| Type | Déclencheur | Exemple |
|------|-------------|---------|
| **Systématique** | Calendrier (jours/heures) | Lubrification tous les 30 jours |
| **Conditionnelle** | Compteur (heures de marche, cycles) | Révision à 10 000 h de fonctionnement |
| **Conditionnelle** | État (vibrations, température) | Alerte si seuil dépassé |
| **Planifiée** | Planning annuel | Arrêt programmé usine |

### Chaîne maintenance préventive

```
Plan de maintenance → Génération OT planifié → Intervention → Exécution plan → Prochaine échéance
         │                        │                    │
         │ • Fréquence             │ • Date due         │ • Réinitialisation
         │ • Équipement            │ • Auto ou manuel   │   compteur/calendrier
         │ • Tâches standard       │                    │
```

### Règles de gestion — Maintenance préventive

- **Avance** : Génération OT X jours avant échéance (paramétrable par plan)
- **Report** : Si OT reporté, recalcul de la prochaine date selon règle (fixe vs glissante)
- **Rattrapage** : Plans en retard listés dans tableau de bord avec indicateur visuel

---

## 1.3 Acteurs, responsabilités et droits (RBAC)

| Rôle | Responsabilités | Droits principaux |
|------|-----------------|-------------------|
| **Administrateur** | Configuration système, utilisateurs, paramètres | CRUD complet, gestion rôles, export données |
| **Responsable maintenance** | Pilotage, validation, planification | Validation pannes, création/affectation OT, rapports, plans maintenance |
| **Planificateur** | Planning interventions, ressources | Création OT préventifs, calendrier, affectation |
| **Technicien** | Exécution interventions | Consultation OT affectés, mise à jour statut, consommations, clôture |
| **Opérateur / Utilisateur** | Terrain, déclaration | Déclaration pannes, consultation équipements, historique limité |
| **Consultant** | Suivi, reporting | Lecture seule (dashboard, rapports, équipements) |

### Matrice des droits par module

| Module | Admin | Resp. | Planif. | Techn. | Opér. | Consult. |
|--------|-------|-------|---------|--------|-------|----------|
| Dashboard | R/W | R/W | R | R | R | R |
| Équipements | CRUD | CRUD | R | R | R | R |
| Déclaration panne | R | R | R | R | C | - |
| Ordres de travail | CRUD | CRUD | CRUD | U (affectés) | R | R |
| Maintenance préventive | CRUD | CRUD | CRUD | U (exécution) | R | R |
| Stocks | CRUD | CRUD | R | R (sorties) | R | R |
| Fournisseurs | CRUD | CRUD | R | R | - | R |
| Rapports | R/W | R/W | R | R | - | R |
| Utilisateurs | CRUD | - | - | - | - | - |

*C=Create, R=Read, U=Update, D=Delete*

---

# 2️⃣ MODÉLISATION DES DONNÉES

## 2.1 Diagramme logique — Vue d'ensemble

```
                                    ┌──────────────────┐
                                    │      SITES       │
                                    │ id, code, nom    │
                                    └────────┬─────────┘
                                             │ 1
                                             │
                                             │ *
                                    ┌────────▼─────────┐      ┌──────────────────┐
                                    │     LIGNES       │      │    FAMILLES      │
                                    │ id, site_id, nom │      │ id, nom, parent  │
                                    └────────┬─────────┘      └────────┬─────────┘
                                             │ 1                       │
                                             │                         │ 1
                                             │ *                       │ *
                                    ┌────────▼─────────────────────────▼─────────┐
                                    │              ÉQUIPEMENTS                    │
                                    │ id, code, nom, ligne_id, famille_id,       │
                                    │ criticite, etat, ...                        │
                                    └────────┬───────────────────────────────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    │ *                      │ *                      │ *
           ┌────────▼────────┐     ┌────────▼────────┐     ┌────────▼────────┐
           │  WORK_ORDERS    │     │ MAINT_PLANS     │     │  FICHIERS_DOC   │
           │ (OT)            │     │ (plans prév.)   │     │ (fiches tech.)  │
           └────────┬────────┘     └─────────────────┘     └─────────────────┘
                    │
                    │ *
           ┌────────▼────────┐     ┌──────────────────┐
           │ INTERVENTIONS   │     │    UTILISATEURS  │
           │ (détail exéc.)  │     │ id, email, role  │
           └────────┬────────┘     └────────┬─────────┘
                    │                       │
                    │                       │ *
                    │              ┌────────▼────────┐     ┌──────────────────┐
                    │              │ PIECES_UTILISEES│     │   FOURNISSEURS   │
                    └──────────────┤ (interv x stock)│     └────────┬─────────┘
                                   └────────┬────────┘              │
                                            │                       │ 1
                                            │ *                     │
                                   ┌────────▼────────┐     ┌────────▼────────┐
                                   │ SPARE_PARTS     │     │  COMMANDES      │
                                   │ (pièces)        │◄────│  FOURNISSEUR    │
                                   └─────────────────┘     └─────────────────┘
```

## 2.2 Schéma détaillé — Tables, champs, relations

### SITES
| Champ | Type | Contrainte | Description |
|-------|------|------------|-------------|
| id | INTEGER | PK, AUTO | Identifiant |
| code | VARCHAR(20) | UNIQUE, NOT NULL | Code court |
| name | VARCHAR(100) | NOT NULL | Nom du site |
| address | TEXT | | Adresse |
| created_at | DATETIME | | |
| updated_at | DATETIME | | |

### LIGNES (de production / zones)
| Champ | Type | Contrainte | Description |
|-------|------|------------|-------------|
| id | INTEGER | PK, AUTO | |
| site_id | INTEGER | FK → sites | |
| code | VARCHAR(20) | NOT NULL | |
| name | VARCHAR(100) | NOT NULL | |
| created_at | DATETIME | | |

### FAMILLES_EQUIPEMENTS (arborescence)
| Champ | Type | Contrainte | Description |
|-------|------|------------|-------------|
| id | INTEGER | PK, AUTO | |
| parent_id | INTEGER | FK → self, NULL | Pour hiérarchie |
| code | VARCHAR(20) | UNIQUE | |
| name | VARCHAR(100) | NOT NULL | |
| created_at | DATETIME | | |

### EQUIPEMENTS
| Champ | Type | Contrainte | Description |
|-------|------|------------|-------------|
| id | INTEGER | PK, AUTO | |
| code | VARCHAR(30) | UNIQUE, NOT NULL | Référence unique |
| name | VARCHAR(200) | NOT NULL | |
| description | TEXT | | |
| ligne_id | INTEGER | FK → lignes, NULL | |
| famille_id | INTEGER | FK → familles, NULL | |
| parent_id | INTEGER | FK → equipment, NULL | Sous-équipement |
| serial_number | VARCHAR(50) | | |
| manufacturer | VARCHAR(100) | | |
| model | VARCHAR(100) | | |
| installation_date | DATE | | |
| location | VARCHAR(100) | | Emplacement physique |
| criticite | ENUM | A, B, C | Impact production |
| status | ENUM | operational, maintenance, out_of_service, retired | |
| technical_specs | JSON | | Spécifications techniques |
| created_at | DATETIME | | |
| updated_at | DATETIME | | |

### WORK_ORDERS (Ordres de travail)
| Champ | Type | Contrainte | Description |
|-------|------|------------|-------------|
| id | INTEGER | PK, AUTO | |
| number | VARCHAR(20) | UNIQUE, NOT NULL | Ex: OT-2025-0001 |
| title | VARCHAR(200) | NOT NULL | |
| description | TEXT | | |
| equipment_id | INTEGER | FK → equipment | |
| type | ENUM | correctif, preventif, amelioration, inspection | |
| priority | ENUM | low, medium, high, critical | |
| status | ENUM | déclaré, validé, planifié, affecté, en_cours, en_attente, clôturé, annulé | |
| criticite_equipement | ENUM | A, B, C | Copie au moment de la création |
| declared_by | INTEGER | FK → users | |
| declared_at | DATETIME | | |
| validated_by | INTEGER | FK → users, NULL | |
| validated_at | DATETIME | NULL | |
| assigned_to | INTEGER | FK → users, NULL | Technicien |
| planned_start | DATETIME | NULL | |
| planned_end | DATETIME | NULL | |
| actual_start | DATETIME | NULL | |
| actual_end | DATETIME | NULL | |
| maintenance_plan_id | INTEGER | FK → maintenance_plans, NULL | Si OT préventif |
| sla_deadline | DATETIME | NULL | Calculé selon priorité |
| created_at | DATETIME | | |
| updated_at | DATETIME | | |

### INTERVENTIONS (détail d'exécution)
| Champ | Type | Contrainte | Description |
|-------|------|------------|-------------|
| id | INTEGER | PK, AUTO | |
| work_order_id | INTEGER | FK → work_orders | |
| description | TEXT | | Travaux effectués |
| hours_spent | DECIMAL(5,2) | | Temps passé |
| spare_part_id | INTEGER | FK → spare_parts, NULL | |
| quantity_used | INTEGER | | |
| technician_id | INTEGER | FK → users | |
| created_at | DATETIME | | |

### MAINTENANCE_PLANS
| Champ | Type | Contrainte | Description |
|-------|------|------------|-------------|
| id | INTEGER | PK, AUTO | |
| equipment_id | INTEGER | FK → equipment | |
| name | VARCHAR(100) | NOT NULL | |
| description | TEXT | | |
| type | ENUM | systematique, conditionnelle, planifiee | |
| frequency_days | INTEGER | | Pour systématique |
| frequency_hours | INTEGER | NULL | Pour conditionnelle (compteur) |
| last_execution_date | DATE | NULL | |
| next_due_date | DATE | NULL | |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | DATETIME | | |
| updated_at | DATETIME | | |

### SPARE_PARTS (Pièces de rechange)
| Champ | Type | Contrainte | Description |
|-------|------|------------|-------------|
| id | INTEGER | PK, AUTO | |
| code | VARCHAR(30) | UNIQUE, NOT NULL | |
| name | VARCHAR(200) | NOT NULL | |
| description | TEXT | | |
| unit | VARCHAR(20) | DEFAULT 'unit' | |
| unit_price | DECIMAL(10,2) | DEFAULT 0 | |
| min_stock | INTEGER | DEFAULT 0 | Seuil alerte |
| supplier_id | INTEGER | FK → suppliers, NULL | |
| is_critical | BOOLEAN | DEFAULT false | Pièce critique |
| created_at | DATETIME | | |
| updated_at | DATETIME | | |

### STOCK_MOVEMENTS
| Champ | Type | Contrainte | Description |
|-------|------|------------|-------------|
| id | INTEGER | PK, AUTO | |
| spare_part_id | INTEGER | FK → spare_parts | |
| quantity | INTEGER | | Positif=entrée, Négatif=sortie |
| type | ENUM | in, out, adjustment, transfer | |
| work_order_id | INTEGER | FK, NULL | Si sortie pour OT |
| user_id | INTEGER | FK → users | |
| reference | VARCHAR(50) | | N° BL, commande... |
| notes | TEXT | | |
| created_at | DATETIME | | |

### SUPPLIERS
| Champ | Type | Contrainte | Description |
|-------|------|------------|-------------|
| id | INTEGER | PK, AUTO | |
| code | VARCHAR(20) | UNIQUE | |
| name | VARCHAR(200) | NOT NULL | |
| contact_person | VARCHAR(100) | | |
| email | VARCHAR(100) | | |
| phone | VARCHAR(30) | | |
| address | TEXT | | |
| created_at | DATETIME | | |
| updated_at | DATETIME | | |

### USERS & ROLES
| Table | Champs principaux |
|-------|-------------------|
| roles | id, name, description |
| users | id, email, password_hash, first_name, last_name, role_id, is_active |

### Contraintes d'intégrité
- `ON DELETE RESTRICT` sur équipement référencé par OT
- `ON DELETE SET NULL` sur assigned_to si utilisateur supprimé
- `CHECK` sur statuts et types énumérés
- Index sur work_orders (status, equipment_id, assigned_to, planned_start)
- Index sur stock_movements (spare_part_id, created_at)

---

# 3️⃣ ARCHITECTURE TECHNIQUE

## 3.1 Backend — Architecture Clean / Hexagonale

```
src/
├── domain/                 # Cœur métier (entités, règles)
│   ├── entities/
│   │   ├── Equipment.js
│   │   ├── WorkOrder.js
│   │   └── ...
│   └── value-objects/
│       └── Priority.js
│
├── application/            # Cas d'utilisation (services métier)
│   ├── use-cases/
│   │   ├── DeclareFailure.js
│   │   ├── CreateWorkOrder.js
│   │   ├── ExecuteMaintenancePlan.js
│   │   └── ...
│   └── dtos/
│
├── infrastructure/         # Adaptateurs externes
│   ├── persistence/        # Repositories (SQLite, PostgreSQL...)
│   │   ├── EquipmentRepository.js
│   │   ├── WorkOrderRepository.js
│   │   └── ...
│   ├── http/               # Controllers Express
│   │   ├── controllers/
│   │   │   ├── AuthController.js
│   │   │   ├── EquipmentController.js
│   │   │   ├── WorkOrderController.js
│   │   │   └── ...
│   │   └── middlewares/
│   │       ├── auth.js
│   │       ├── rbac.js
│   │       ├── errorHandler.js
│   │       ├── requestLogger.js
│   │       └── validate.js
│   └── services/
│       └── NotificationService.js
│
├── config/
│   ├── database.js
│   └── env.js
│
└── server.js
```

### Controllers (HTTP)
- Reçoivent requêtes, valident entrées (express-validator)
- Appellent les use-cases
- Retournent réponses HTTP (JSON, codes status)

### Services métier (Use-cases)
- Logique métier pure
- Orchestrent repositories et règles
- Indépendants du transport (HTTP, CLI...)

### Repositories
- Abstraction accès données
- Interface : `findById`, `findAll`, `save`, `delete`
- Implémentation SQLite/PostgreSQL interchangeable

### Middlewares
| Middleware | Rôle |
|------------|------|
| auth | Vérification JWT, injection user |
| rbac | Vérification droits par rôle |
| errorHandler | Capture erreurs, format réponse standard |
| requestLogger | Log requêtes (métrique, audit) |
| validate | Validation schémas (body, params, query) |

### Stratégie sécurité
- **JWT** : Access token (15 min) + Refresh token (7 j) optionnel
- **RBAC** : Middleware `requireRole(['responsable', 'admin'])`
- **Validation** : Sanitization entrées (XSS, injection)
- **Rate limiting** : Limite requêtes / IP
- **CORS** : Origines autorisées explicites

### Gestion erreurs
- `AppError` : classe métier avec code et message
- Codes : `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`
- Log structuré (winston/pino) : niveau, message, stack, userId, requestId

---

## 3.2 Frontend — Architecture modulaire

```
src/
├── app/                    # Configuration app
│   ├── App.jsx
│   ├── routes/
│   │   ├── AppRoutes.jsx
│   │   ├── PrivateRoute.jsx
│   │   └── RoleGuard.jsx
│   └── store/              # État global (Zustand)
│       ├── index.js
│       ├── authStore.js
│       └── uiStore.js
│
├── features/               # Par domaine métier
│   ├── dashboard/
│   │   ├── pages/
│   │   ├── components/
│   │   └── hooks/
│   ├── equipment/
│   ├── work-orders/
│   ├── maintenance-plans/
│   ├── stock/
│   ├── suppliers/
│   └── reports/
│
├── shared/                 # Partagé
│   ├── components/         # Boutons, formulaires, tableaux
│   │   ├── Button/
│   │   ├── DataTable/
│   │   ├── FormField/
│   │   └── ...
│   ├── hooks/
│   │   ├── useApi.js
│   │   ├── useAuth.js
│   │   └── usePagination.js
│   ├── services/
│   │   ├── api.js
│   │   └── api/equipment.js, workOrders.js, ...
│   └── utils/
│
├── theme/
│   └── designTokens.js
│
└── main.jsx
```

### Gestion d'état
- **Zustand** recommandé : léger, simple, pas de boilerplate
- Stores : `authStore`, `uiStore` (sidebar, thème), stores métier optionnels
- État serveur : React Query / SWR pour cache, revalidation, loading/error

### Routing sécurisé
- `PrivateRoute` : Redirige vers /login si non authentifié
- `RoleGuard` : Masque ou redirige si rôle insuffisant
- Routes chargées dynamiquement (lazy) par rôle si besoin

---

# 4️⃣ DÉTAILS PAR MODULE

## 4.1 Dashboard

**Objectif** : Vue d’ensemble KPIs et activités en temps réel.

**Écrans** :
- Dashboard principal (KPIs, graphiques, activité récente)
- Widgets configurables (optionnel v2)

**Actions** :
- Filtrer par période (7j, 30j, 90j)
- Cliquer sur un OT récent → détail
- Cliquer sur alerte stock → liste pièces en rupture

**APIs** :
- `GET /api/dashboard/kpis` — Disponibilité, MTBF, MTTR
- `GET /api/dashboard/charts` — Données graphiques
- `GET /api/dashboard/recent` — OT récents
- `GET /api/dashboard/alerts` — Alertes (stock, SLA)

**États** : loading (skeleton), error (toast + retry), success

---

## 4.2 Équipements

**Objectif** : Gestion du parc, arborescence, fiches techniques.

**Écrans** :
- Liste (filtres : site, ligne, famille, statut)
- Fiche équipement (détail, historique OT, documents)
- Formulaire création/édition
- Vue arborescence (tree)

**Actions** :
- CRUD équipement
- Upload fiche technique
- Lien équipement ↔ pièces (BOM)
- Export liste (Excel)

**APIs** :
- `GET /api/equipment` (query: search, siteId, ligneId, familleId, status)
- `GET /api/equipment/:id`
- `GET /api/equipment/:id/history`
- `GET /api/equipment/tree`
- `POST /api/equipment`
- `PUT /api/equipment/:id`
- `DELETE /api/equipment/:id`

**États** : loading, error, empty, success

---

## 4.3 Ordres de travail

**Objectif** : Suivi du cycle de vie des OT.

**Écrans** :
- Liste (filtres : statut, priorité, affecté, équipement)
- Détail OT (en-tête, timeline, interventions, pièces)
- Formulaire déclaration panne
- Formulaire création OT (responsable)
- Calendrier des OT planifiés

**Actions** :
- Déclarer panne
- Valider / rejeter (responsable)
- Affecter technicien
- Démarrer / terminer intervention
- Enregistrer pièces utilisées
- Clôturer (avec TDR)

**APIs** :
- `GET /api/work-orders` (filtres)
- `GET /api/work-orders/:id`
- `GET /api/work-orders/calendar`
- `POST /api/work-orders`
- `PUT /api/work-orders/:id`
- `POST /api/work-orders/:id/start`
- `POST /api/work-orders/:id/complete`
- `POST /api/work-orders/:id/interventions`

**États** : loading, error, empty, success, submitting

---

## 4.4 Maintenance préventive

**Objectif** : Plans, génération OT, suivi échéances.

**Écrans** :
- Liste des plans
- Formulaire plan
- Calendrier échéances
- OT générés (liste)

**Actions** :
- CRUD plan
- Générer OT manuellement
- Marquer plan exécuté (recalcul prochaine date)

**APIs** :
- `GET /api/maintenance-plans`
- `GET /api/maintenance-plans/due`
- `POST /api/maintenance-plans`
- `PUT /api/maintenance-plans/:id`
- `POST /api/maintenance-plans/:id/execute`
- `POST /api/maintenance-plans/:id/generate-ot`

---

## 4.5 Stocks

**Objectif** : Pièces, mouvements, alertes.

**Écrans** :
- Liste pièces (filtres, seuil bas)
- Fiche pièce (stock, mouvements)
- Formulaire entrée/sortie
- Ajustement stock

**Actions** :
- CRUD pièce
- Entrée (réception)
- Sortie (liée à OT ou manuelle)
- Ajustement inventaire
- Seuils min (alerte)

**APIs** :
- `GET /api/stock/parts`
- `GET /api/stock/parts/:id`
- `GET /api/stock/parts/:id/movements`
- `GET /api/stock/alerts`
- `POST /api/stock/parts`
- `POST /api/stock/movements`

---

## 4.6 Fournisseurs

**Objectif** : Répertoire, commandes.

**Écrans** :
- Liste fournisseurs
- Fiche fournisseur (coordonnées, commandes)
- Formulaire commande
- Détail commande + lignes

**APIs** :
- `GET /api/suppliers`
- `GET /api/suppliers/:id`
- `GET /api/suppliers/orders`
- `POST /api/suppliers`
- `PUT /api/suppliers/:id`
- `POST /api/suppliers/orders`
- `POST /api/suppliers/orders/:id/lines`

---

## 4.7 Rapports

**Objectif** : Analyse, coûts, export.

**Écrans** :
- Sélecteur rapport (coûts, OT, disponibilité…)
- Paramètres (dates, filtres)
- Résultats (tableau, graphique)
- Export PDF / Excel

**APIs** :
- `GET /api/reports/maintenance-costs`
- `GET /api/reports/work-orders`
- `GET /api/reports/availability`
- `GET /api/reports/export/excel`
- `GET /api/reports/export/pdf`

---

# 5️⃣ UX / UI DÉTAILLÉE

## 5.1 Wireframes textuels

### Écran Login
```
┌─────────────────────────────────────────────────┐
│                    [Logo GMAO]                   │
│                                                 │
│              Connexion à GMAO                    │
│  ┌─────────────────────────────────────────┐   │
│  │ Email                                   │   │
│  └─────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────┐   │
│  │ Mot de passe                             │   │
│  └─────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────┐   │
│  │           [Se connecter]                 │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Dashboard
```
┌──────┬────────────────────────────────────────────────────────────┐
│ SIDE │  Tableau de bord                      [User] [Thème]       │
│ BAR  ├────────────────────────────────────────────────────────────┤
│      │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│ • DB │  │Disponib.│ │  MTTR   │ │  MTBF   │ │ OT actif│          │
│ • Eq │  │  95.2%  │ │  2.3 h  │ │  120 j  │ │   12    │          │
│ • OT │  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│ • Mnt│                                                             │
│ • Stk│  ┌─────────────────────┐ ┌─────────────────────┐           │
│ • Fnr│  │ OT par statut       │ │ Priorités           │           │
│ • Rpt│  │ [Bar Chart]         │ │ [Pie Chart]         │           │
│      │  └─────────────────────┘ └─────────────────────┘           │
│      │  ┌─────────────────────────────────────────────────────┐   │
│      │  │ Activité récente                                    │   │
│      │  │ OT-001 | Presse P500 | En cours | [Voir]            │   │
│      │  │ OT-002 | Convoyeur   | Terminé  | [Voir]            │   │
│      │  └─────────────────────────────────────────────────────┘   │
└──────┴────────────────────────────────────────────────────────────┘
```

### Liste OT
```
┌──────────────────────────────────────────────────────────────────┐
│ Ordres de travail              [Filtres ▾] [+ Nouvel OT]         │
├──────────────────────────────────────────────────────────────────┤
│ ☐ N°      │ Titre          │ Équipement  │ Statut   │ Priorité  │
│ ☐ OT-001  │ Fuite huile    │ Presse P500 │ En cours │ Haute     │
│ ☐ OT-002  │ Remplacement   │ Convoyeur   │ Planifié │ Medium    │
│   ...                                                            │
└──────────────────────────────────────────────────────────────────┘
```

## 5.2 Règles UX terrain

- **Mobile** : Navigation bottom tabs, formulaires en une colonne, boutons ≥ 44px
- **Tablette** : Sidebar repliable, tableaux avec scroll horizontal si besoin
- **Desktop** : Sidebar fixe, tableaux pleine largeur

## 5.3 Codes couleur

| Élément | Couleur | Usage |
|---------|---------|-------|
| Priorité critical | Rouge #ef4444 | Urgent |
| Priorité high | Orange #f59e0b | Important |
| Priorité medium | Bleu #3b82f6 | Normal |
| Priorité low | Gris #6b7280 | Faible |
| Statut en cours | Bleu | |
| Statut terminé | Vert #22c55e | |
| Statut annulé | Gris | |
| Alerte stock | Orange | Rupture / seuil |

## 5.4 Design system

- **Boutons** : Primary (plein), Secondary (outline), Danger (suppression)
- **Formulaires** : Labels au-dessus, erreur sous le champ, bouton submit en bas
- **Tableaux** : En-têtes fixes au scroll, tri cliquable, pagination
- **Feedback** : Toast pour succès/erreur, skeleton pour loading

---

# 6️⃣ SCÉNARIOS D’USAGE

## Scénario 1 : Panne critique

1. Opérateur constate arrêt presse (criticité A).
2. Déclare panne : équipement, « fuite hydraulique majeure », priorité critical.
3. Système calcule SLA 2h, envoie alerte responsable.
4. Responsable valide, crée OT, affecte technicien.
5. Technicien reçoit notification, démarre intervention.
6. Utilise 2 joints (sortie stock), termine en 1h30.
7. Clôture OT avec TDR.
8. Dashboard mis à jour (MTTR, disponibilité).

## Scénario 2 : Maintenance préventive auto

1. Plan « Lubrification mensuelle » sur Presse P500, échéance J+2.
2. Job nocturne génère OT planifié.
3. Matin : technicien voit OT dans sa liste, démarre.
4. Exécute tâches standard, marque plan exécuté.
5. Prochaine échéance = aujourd’hui + 30 jours.

## Scénario 3 : Rupture pièce critique

1. Technicien sort dernière pièce pour OT.
2. Stock passe sous seuil min → alerte créée.
3. Responsable reçoit notification, consulte liste alertes.
4. Crée commande fournisseur pour pièce critique.
5. À réception : entrée stock, alerte disparaît.

---

# 7️⃣ QUALITÉ, PERFORMANCE, DÉPLOIEMENT

## Tests

- **Unitaires** : Services métier, utilitaires (Jest)
- **Intégration** : APIs (supertest), repositories
- **E2E** : Flux critiques (Playwright / Cypress)

## Performance

- **Pagination** : 20–50 lignes par page
- **Cache** : Redis (sessions, rate limit) en production
- **Index DB** : Sur colonnes filtrées/triées

## Sécurité (OWASP)

- Validation/sanitization entrées
- Paramètres préparés (anti-injection)
- HTTPS, cookies httpOnly
- Headers sécurité (CSP, HSTS, X-Frame-Options)

## Déploiement

- **Docker** : `Dockerfile` backend + frontend (build)
- **docker-compose** : app + base de données
- **CI/CD** : GitHub Actions — test, build, déploiement
