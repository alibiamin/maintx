# API GMAO / MAINTX — Intégration applications externes

Ce document décrit comment utiliser l’API REST de la GMAO depuis des **applications externes** (pointeuse, ERP, logiciel métier, scripts, mobiles, etc.).

---

## 1. Informations générales

| Élément | Valeur |
|--------|--------|
| **Format** | JSON (requêtes et réponses) |
| **Base URL** | `https://votre-domaine.com/api` ou `http://localhost:5000/api` |
| **Authentification** | JWT (Bearer token) |
| **Spécification** | OpenAPI 3.0 : `GET /api/openapi.json` |
| **Santé** | `GET /api/health` (sans auth) |
| **Présentation API** | `GET /api` (sans auth) |

### 1.1 En-têtes requis pour les requêtes authentifiées

```
Content-Type: application/json
Authorization: Bearer <votre_token_jwt>
```

### 1.2 CORS

L’API accepte les requêtes cross-origin. En-têtes autorisés : `Content-Type`, `Authorization`, `Accept`. Méthodes : `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`.

---

## 2. Authentification

### 2.1 Obtenir un token (connexion)

**Endpoint :** `POST /api/auth/login`  
**Authentification :** Aucune (endpoint public).

**Corps de la requête (JSON) :**

```json
{
  "email": "utilisateur@exemple.com",
  "password": "MotDePasseSecret"
}
```

**Réponse 200 (succès) :**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 5,
    "email": "utilisateur@exemple.com",
    "firstName": "Jean",
    "lastName": "Dupont",
    "role": "technicien"
  },
  "tenantId": 1
}
```

- **token** : à envoyer dans `Authorization: Bearer <token>` pour toutes les autres requêtes.
- **tenantId** : présent pour un compte client (multi-tenant). Les données renvoyées par l’API sont limitées à ce client.

**Réponses d’erreur :**

| Code | Signification |
|------|----------------|
| 400 | Données invalides (ex. email incorrect). Corps : `{ "errors": [ ... ] }` |
| 401 | Email ou mot de passe incorrect. Corps : `{ "error": "Email ou mot de passe incorrect" }` |
| 403 | Compte désactivé, licence expirée ou non active. Corps : `{ "error": "...", "code": "LICENSE_EXPIRED" }` (codes possibles : `LICENSE_EXPIRED`, `LICENSE_NOT_ACTIVE`, `TENANT_INVALID`) |
| 429 | Trop de tentatives de connexion (limite par IP). Attendre 15 minutes. |

**Exemple cURL :**

```bash
curl -X POST https://votre-domaine.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"utilisateur@exemple.com","password":"MotDePasseSecret"}'
```

### 2.2 Utiliser le token

Pour toute requête autre que `/api/auth/login`, `/api/health` et `GET /api` :

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Réponses liées au token :**

| Code | Signification |
|------|----------------|
| 401 | Token manquant, expiré ou invalide. Corps : `{ "error": "Token manquant ou invalide" }` ou `{ "error": "Token expiré ou invalide" }` |
| 403 | Accès refusé (droits insuffisants ou licence). Corps : `{ "error": "..." }`, éventuellement `"code": "LICENSE_EXPIRED"` |

En cas de **401**, l’application externe doit refaire un `POST /api/auth/login` pour obtenir un nouveau token.

### 2.3 Vérifier le profil (optionnel)

**Endpoint :** `GET /api/auth/me`  
**Authentification :** Requise.

**Réponse 200 :**

```json
{
  "id": 5,
  "email": "utilisateur@exemple.com",
  "firstName": "Jean",
  "lastName": "Dupont",
  "role": "technicien",
  "isAdmin": false
}
```

---

## 3. Format des réponses d’erreur

Toutes les erreurs API renvoient un corps JSON.

**Structure type :**

```json
{
  "error": "Message d'erreur lisible"
}
```

**En cas de validation (400) :**

```json
{
  "errors": [
    { "msg": "Valeur invalide", "param": "body.email", "location": "body" }
  ]
}
```

**Champs optionnels :**

- **code** : code machine (ex. `LICENSE_EXPIRED`, `TENANT_INVALID`).
- **path** : pour 404, méthode + chemin (ex. `"GET /api/work-orders/999"`).
- **message** : détail technique (souvent uniquement en développement).

---

## 4. Endpoints principaux pour l’intégration externe

### 4.1 Ordres de travail (OT)

| Méthode | URL | Description |
|--------|-----|-------------|
| GET | `/api/work-orders` | Liste des OT (query : `status`, `page`, `limit`, `equipmentId`, `assignedTo`) |
| GET | `/api/work-orders/:id` | Détail d’un OT (coûts, pièces consommées, temps par phase) |
| POST | `/api/work-orders` | Créer un OT |
| PUT | `/api/work-orders/:id` | Modifier un OT (statut, workflow, dates) |
| PUT | `/api/work-orders/:id/approve` | Approuver un OT en attente (seuil montant) |

**Exemple création OT (POST /api/work-orders) :**

```json
{
  "title": "Révision moteur M01",
  "description": "Contrôle et graissage",
  "equipmentId": 3,
  "typeId": 1,
  "priority": "medium",
  "assignedTo": 5,
  "plannedStart": "2025-03-01T08:00:00",
  "plannedEnd": "2025-03-01T12:00:00"
}
```

**Exemple réponses listes :**  
- Avec pagination : `{ "data": [ ... ], "total": 42 }`  
- Sans pagination : tableau `[ ... ]`

---

### 4.2 Import des pointages (pointeuse)

Permet d’alimenter la GMAO à partir d’une pointeuse ou d’un fichier exporté.

**Associer un badge à un technicien :**  
- `GET /api/time-entries/badges` : liste des associations badge → technicien  
- `POST /api/time-entries/badges` : créer/modifier une association  

Corps :

```json
{
  "technicianId": 5,
  "badgeCode": "BADGE001"
}
```

**Importer des pointages :**  
`POST /api/time-entries/import`

- **Fichier CSV** : envoi en `multipart/form-data`, champ `file`.  
  Colonnes possibles : `technician_id`, `badge_code`, `occurred_at`, `type` (in/out) ou `date`, `heure`, `type`, `badge_code`.
- **Corps JSON** : tableau de pointages  

```json
{
  "entries": [
    {
      "badgeCode": "BADGE001",
      "occurredAt": "2025-02-20T08:00:00",
      "type": "in"
    },
    {
      "badgeCode": "BADGE001",
      "occurredAt": "2025-02-20T17:30:00",
      "type": "out"
    }
  ]
}
```

Ou tableau direct :

```json
[
  { "technicianId": 5, "occurredAt": "2025-02-20T08:00:00", "type": "in" },
  { "technicianId": 5, "occurredAt": "2025-02-20T17:30:00", "type": "out" }
]
```

**Réponse 201 :** `{ "imported": 2, "entries": [ ... ] }`

---

### 4.3 Équipements et compteurs

| Méthode | URL | Description |
|--------|-----|-------------|
| GET | `/api/equipment` | Liste des équipements (query : `page`, `limit`, `status`, `search`) |
| GET | `/api/equipment/:id` | Détail d’un équipement |
| GET | `/api/equipment/:id/counters` | Compteurs actuels (heures, cycles, etc.) |
| PUT | `/api/equipment/:id/counters` | Mettre à jour un compteur (body : `counterType`, `value`, `unit`) |
| GET | `/api/equipment/:id/counter-history` | Historique des compteurs (courbes). Query : `counterType`, `limit` |
| GET | `/api/equipment/:id/total-cost` | Coût total vie de l’actif |

**Exemple mise à jour compteur (PUT /api/equipment/3/counters) :**

```json
{
  "counterType": "hours",
  "value": 5250.5,
  "unit": "h"
}
```

---

### 4.4 Stock par site

| Méthode | URL | Description |
|--------|-----|-------------|
| GET | `/api/stock-by-site` | Liste des stocks par site (query : `siteId`, `sparePartId`) |
| GET | `/api/stock-by-site/summary` | Synthèse par site |
| PUT | `/api/stock-by-site/:siteId/:sparePartId` | Mettre à jour une quantité (body : `quantity`) |

---

### 4.5 Rapports planifiés

| Méthode | URL | Description |
|--------|-----|-------------|
| GET | `/api/scheduled-reports` | Liste des rapports planifiés |
| GET | `/api/scheduled-reports/types` | Types disponibles (`maintenance-costs`, `work-orders`, `kpis`, etc.) |
| POST | `/api/scheduled-reports` | Créer un rapport planifié |

Corps type :

```json
{
  "reportType": "work-orders",
  "frequency": "weekly",
  "frequencyParam": "1",
  "recipientEmails": "responsable@exemple.com",
  "paramsJson": "{\"startDate\":\"2025-02-01\",\"endDate\":\"2025-02-28\"}"
}
```

---

### 4.6 Plan de charge (effectif)

**GET** `/api/planning/workload?startDate=2025-02-01&endDate=2025-02-28`

Retourne, par technicien, les heures de charge (OT) et la capacité sur la période.

**Réponse type :** `{ "start": "...", "end": "...", "workload": [ { "technicianId", "technicianName", "chargeHours", "capacityHours", "utilizationPercent" }, ... ] }`

---

### 4.7 Paramétrage (seuils)

| Méthode | URL | Description |
|--------|-----|-------------|
| GET | `/api/settings/budget-alert-threshold` | Seuil % d’alerte dépassement budget |
| POST | `/api/settings/budget-alert-threshold` | Modifier (body : `{ "value": 90 }`) |
| GET | `/api/settings/approval-threshold-amount` | Seuil montant (€) pour approbation OT |
| POST | `/api/settings/approval-threshold-amount` | Modifier (body : `{ "value": 5000 }`) |

---

### 4.8 Autres endpoints utiles

- **Sites :** `GET /api/sites` (liste des sites).
- **Budgets :** `GET /api/budgets` (avec `current_cost`).
- **Présence / synthèse :** `GET /api/presence/summary?date=2025-02-20`.
- **Pointages (lecture) :** `GET /api/time-entries?dateFrom=...&dateTo=...&technicianId=...`.
- **Documents obligatoires :** `GET /api/required-document-types/check?equipmentId=3` (manquants/expirés).

---

## 5. Bonnes pratiques pour les applications externes

1. **Conserver le token** côté client (variable, fichier, coffre-fort) et l’envoyer dans `Authorization: Bearer <token>` à chaque requête.
2. **Gérer le 401** : en cas de réponse 401, refaire un `POST /api/auth/login` et réessayer la requête avec le nouveau token.
3. **Gérer le 403** : vérifier le champ `code` (`LICENSE_EXPIRED`, etc.) pour afficher un message adapté et inviter à contacter l’administrateur.
4. **Limiter les tentatives de login** : l’API applique une limite par IP (ex. 10 tentatives / 15 min). En cas de 429, attendre avant de réessayer.
5. **Utiliser le Content-Type** : envoyer systématiquement `Content-Type: application/json` pour les requêtes avec corps (POST, PUT).
6. **Pagination** : pour les listes volumineuses, utiliser `page` et `limit` (ex. `GET /api/work-orders?page=1&limit=50`).
7. **Dates/heures** : utiliser le format ISO 8601 (ex. `2025-02-20T08:00:00` ou `2025-02-20T08:00:00.000Z`).

---

## 6. Spécification OpenAPI

La spécification OpenAPI 3.0 de l’API est exposée à l’URL :

```
GET /api/openapi.json
```

(sans authentification)

Vous pouvez l’importer dans Postman, Insomnia, Swagger UI ou tout outil supportant OpenAPI 3 pour générer des clients et tester les endpoints. L’authentification y est décrite comme schéma Bearer JWT ; il suffit de renseigner le token obtenu via `POST /api/auth/login`.

---

## 7. Résumé des URLs sans authentification

- `GET /api` : présentation de l’API  
- `GET /api/health` : santé du serveur  
- `GET /api/openapi.json` : spécification OpenAPI  
- `POST /api/auth/login` : connexion (obtention du token)  

Toutes les autres URLs sous `/api` nécessitent l’en-tête `Authorization: Bearer <token>`.
