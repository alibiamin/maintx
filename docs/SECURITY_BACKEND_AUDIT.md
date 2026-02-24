# Audit sécurité backend — Ne jamais faire confiance au frontend

*Objectifs : empêcher les modifications illégitimes, éviter les corruptions de données. Contexte : Node.js + SQLite, API REST, JWT, multi-tenant.*

---

## 1. Synthèse

| Élément | État |
|--------|------|
| Authentification | Toutes les routes API (hors login/health/openapi) passent par `authenticate` (JWT + `req.db` / `req.tenantId`). |
| Autorisation | Rôles (admin, responsable, technicien) via `authorize(ROLES.*)` sur les routes sensibles. |
| Champs sensibles (créateur, clôture) | `created_by` sur OT déjà fixé à `req.user.id`. **Corrigé :** `completed_by` à la clôture OT fixé à `req.user.id` (plus jamais pris du body). |
| Validation des paramètres | `param('id').isInt()` (ou équivalent) utilisé sur les routes `:id` des modules principaux (work-orders, equipment, etc.). **Corrigé :** documents GET/DELETE `:id` et `:id/download`. |
| Validation des body | express-validator utilisé sur les routes critiques (login, users, stock movements, work orders, equipment, etc.). |

---

## 2. Routes sans authentification (volontaires)

Les seules routes accessibles sans JWT sont :

- `GET /api/health` — état du serveur
- `GET /api` — description de l’API
- `GET /api/openapi.json` — schéma OpenAPI (si présent)
- `POST /api/auth/login` — connexion (email + mot de passe, rate limit appliqué)

Aucune action sensible (lecture de données métier, écriture) n’est exposée sans authentification.

---

## 3. Vulnérabilités identifiées et corrections

### 3.1 Clôture OT : `completed_by` pris depuis le client (corrigé)

- **Risque :** Un admin/responsable pouvait envoyer `completedBy: <autre_user_id>` et attribuer la clôture à un autre utilisateur → traçabilité faussée.
- **Correction :** Lors du passage en `status === 'completed'`, le backend fixe désormais systématiquement `completed_by = req.user.id`. La valeur envoyée par le frontend est ignorée.
- **Fichier :** `gmao/backend/src/routes/workOrders.js` (PUT `/api/work-orders/:id`).

### 3.2 Validation des paramètres `id` sur les documents (corrigé)

- **Risque :** Appels du type `GET /api/documents/abc` ou `GET /api/documents/1;DROP TABLE--` sans validation → erreurs ou comportements indéterminés (SQLite paramétré limite l’injection, mais la cohérence des réponses est améliorée avec une validation stricte).
- **Correction :** Ajout de `param('id').isInt({ min: 1 })` et `validationResult` sur `GET /:id`, `GET /:id/download`, `DELETE /:id`.
- **Fichier :** `gmao/backend/src/routes/documents.js`.

### 3.3 PUT `/api/auth/me` — pas de champs sensibles

- Vérifié : seuls `pinned_menu_items` et `dashboard_layout` sont mis à jour. Aucun `role_id`, `tenant_id` ou privilège n’est accepté depuis le body.

---

## 4. Points de vigilance (déjà sains)

- **Création OT :** `created_by` est toujours fixé à `req.user.id`, jamais lu depuis `req.body`.
- **Utilisateurs (POST/PUT) :** Réservés aux admins (`authorize(ROLES.ADMIN)`). Les champs `roleId` / `tenantId` sont des données métier gérées par l’admin, pas une élévation de privilège par un utilisateur normal.
- **Multi-tenant :** Le tenant est dérivé du JWT (`req.tenantId`) et de la base attachée (`req.db`), pas d’un paramètre client.
- **Requêtes SQL :** Utilisation de requêtes paramétrées (`?`), pas de concaténation de chaînes pour les paramètres → pas d’injection SQL classique.

---

## 5. Routes sensibles (liste non exhaustive)

| Route | Rôle requis | Remarque |
|-------|-------------|----------|
| `POST /api/auth/login` | — | Rate limit, message générique en cas d’échec. |
| `PUT /api/auth/me` | Authentifié | Whitelist stricte (préférences UI uniquement). |
| `GET/POST/PUT/DELETE /api/users` | Admin | Gestion des comptes et rôles. |
| `PUT /api/work-orders/:id` | Admin, Responsable, Technicien | Clôture réservée admin/responsable ; `completed_by` = utilisateur connecté. |
| `DELETE /api/equipment/:id` | Admin | Contrôles de cohérence (OT, plans, contrats, etc.) avant suppression. |
| `POST /api/stock/movements` | Authentifié | Quantités validées (entrée/sortie/transfert ≥ 1, réglage ≥ 0). |
| `GET/POST/DELETE /api/documents` | Authentifié | Validation `param('id').isInt()` sur les routes avec `:id`. |
| `GET/POST/PUT/DELETE /api/tenants/*` | Admin | Gestion des tenants. |

---

## 6. Recommandations générales (Node + SQLite)

1. **Ne jamais faire confiance au frontend**  
   Pour les champs d’audit ou de traçabilité (`created_by`, `updated_by`, `completed_by`, etc.), toujours utiliser `req.user.id` (ou équivalent) côté serveur.

2. **Whitelist des champs modifiables**  
   Pour chaque PUT/PATCH, n’accepter que les champs explicitement autorisés (comme pour `PUT /work-orders/:id` et `PUT /auth/me`).

3. **Validation des entrées**  
   - Paramètres de route : `param('id').isInt()` (ou `.isInt({ min: 1 })`) pour tous les `:id`.  
   - Body : `express-validator` (ou équivalent) pour les types, longueurs et énumérations.

4. **Réponses d’erreur**  
   Éviter de renvoyer des détails internes (stack, chemins) en production ; messages génériques pour login et erreurs 500.

5. **SQLite**  
   Continuer à n’utiliser que des requêtes paramétrées ; pas de tri/ordre ou filtres dynamiques construits par concaténation de chaînes.

6. **Évolutions**  
   À chaque nouvelle route avec `:id`, ajouter une validation `param('id').isInt()`. À chaque nouveau champ “sensible” (utilisateur, rôle, tenant), le fixer côté serveur plutôt que de le lire depuis le body.

---

## 7. Résumé des corrections appliquées

- **workOrders.js :** À la clôture d’un OT (`status === 'completed'`), `completed_by` est forcé à `req.user.id` (plus de lecture de `req.body.completedBy`).
- **documents.js :** Validation `param('id').isInt({ min: 1 })` + `validationResult` sur `GET /:id`, `GET /:id/download`, `DELETE /:id`.

Ces changements limitent les modifications illégitimes et améliorent la cohérence des données sans introduire de dépendances externes (uniquement Node + SQLite + express-validator déjà en place).
