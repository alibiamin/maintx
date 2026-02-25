# Audit sécurité, production et risques – MAINTX (GMAO SaaS)

**Rôle :** Architecte SaaS senior + auditeur sécurité + responsable production  
**Périmètre :** Modèle multi-tenant, auth, DB, facturation/licences, infra, RGPD  
**Hypothèses :** Application en production 24/7, clients industriels déjà présents  

---

## 1. Problèmes CRITIQUES (sécurité, fuite/perte de données, indisponibilité)

### 1.1 Fuite de données cross-tenant : création d’utilisateurs avec `tenantId` venant du body

| Champ | Détail |
|-------|--------|
| **Niveau** | 🔴 **CRITIQUE** |
| **Où** | Auth / API users & techniciens |
| **Impact** | Un admin **client** peut créer un utilisateur (ou technicien) dans **un autre tenant** en envoyant `tenantId` (ou `tenantId: bodyTenantId`) dans le body. Fuite de données (comptes créés chez le concurrent), escalade de privilèges possible. |
| **Solution** | **Ne jamais utiliser `req.body.tenantId` pour l’affectation.** Utiliser **uniquement `req.tenantId`** (JWT) pour la création. Fichiers à corriger : `routes/technicians.js` (POST, ligne ~38), `routes/users.js` (POST, ligne ~120). Règle : `const tenantId = req.tenantId;` (et pour les admins MAINTX qui créent un user dans un tenant, utiliser un endpoint dédié protégé par `requireMaintxAdmin` avec l’id tenant en paramètre contrôlé côté serveur). |
| **Priorité** | **Avant prod** |

### 1.2 Permissions et rôles modifiables par un admin client

| Champ | Détail |
|-------|--------|
| **Niveau** | 🔴 **CRITIQUE** |
| **Où** | API permissions (`/api/permissions`, `/api/roles`) |
| **Impact** | Les rôles et `role_permissions` sont **globaux** (gmao.db). Un admin **client** avec `settings.update` peut appeler `PUT /api/roles/:id/permissions` et modifier les permissions de **tous les tenants**. Désactivation de la sécurité au niveau plateforme. |
| **Solution** | Réserver la gestion des rôles/permissions à la plateforme : appliquer **`requireMaintxAdmin`** sur les routes qui modifient les rôles ou les permissions (POST/PUT sur roles et role_permissions). Garder en lecture (GET) pour les clients si besoin, en lecture seule. |
| **Priorité** | **Avant prod** |

### 1.3 Login sans vérification du statut tenant (suspended / deleted)

| Champ | Détail |
|-------|--------|
| **Niveau** | 🔴 **CRITIQUE** (cohérence + sécurité) |
| **Où** | Auth – `POST /api/auth/login` |
| **Impact** | Le login ne consulte pas `tenants.status` ni `tenants.deleted_at`. Un client **suspended** ou **deleted** reçoit quand même un JWT, puis 403 sur chaque requête métier. Expérience dégradée, confusion support, et token émis inutilement (surface d’attaque). |
| **Solution** | Dans la route login, après récupération du tenant (comme pour les dates de licence), récupérer aussi `status` et `deleted_at`. Refuser la connexion (403) si `status` ∈ { suspended, expired, deleted } ou si `deleted_at` est renseigné. Aligner le message sur le middleware (ex. « Compte client suspendu / supprimé »). |
| **Priorité** | **Avant prod** |

### 1.4 Risque path traversal sur upload / téléchargement de documents

| Champ | Détail |
|-------|--------|
| **Niveau** | 🔴 **CRITIQUE** (si exploitable) |
| **Où** | API documents (upload destination, download) |
| **Impact** | **Upload :** `entity_type` (req.body) est utilisé dans `path.join(uploadsDir, entityType)`. Une valeur du type `../../etc` ou `..\\windows` peut permettre d’écrire hors du répertoire prévu. **Download :** `res.download(doc.file_path, ...)` : si `file_path` en base contient un chemin absolu ou avec `..`, lecture de fichiers arbitraires. |
| **Solution** | (1) **Upload :** Normaliser `entity_type` et n’accepter qu’un segment « safe » (ex. regex `^[a-zA-Z0-9_-]+$`), pas de `path.join` avec une entrée utilisateur non sanitized. (2) **Download :** Vérifier que `doc.file_path` est un chemin **enfant de `uploadsDir`** (résolution réelle avec `path.resolve` + `startsWith`) et refuser sinon. Ne jamais faire confiance à la valeur en base. |
| **Priorité** | **Avant prod** |

### 1.5 Health check sans contrôle DB / disque

| Champ | Détail |
|-------|--------|
| **Niveau** | 🔴 **ÉLEVÉ** (indisponibilité) |
| **Où** | Infra – `GET /api/health` |
| **Impact** | Le health check renvoie toujours `{ status: 'ok' }` sans tester la base ni le disque. En cas de corruption SQLite, disque plein ou base admin injoignable, le load balancer continue d’envoyer du trafic → erreurs 500 en chaîne, clients en panne. |
| **Solution** | Dans `/api/health` : (1) Exécuter une requête légère sur gmao.db (ex. `SELECT 1` ou lecture d’une ligne d’une table système). (2) Vérifier que le répertoire `data` (ou celui des backups) est accessible en écriture si pertinent. Retourner 503 si la DB ou le disque est injoignable, 200 sinon. Option : health « léger » (200 si process up) et « deep » (avec DB) pour des checks différents (ex. readiness vs liveness). |
| **Priorité** | **Avant prod** |

---

## 2. Problèmes GRAVES à moyen terme (scalabilité, maintenance, dette technique)

### 2.1 Bases client et admin en mémoire (sql.js)

| Champ | Détail |
|-------|--------|
| **Niveau** | 🟠 **ÉLEVÉ** |
| **Où** | DB – couche données |
| **Impact** | Chaque base (gmao.db + une par tenant) est chargée **en RAM**. Avec 50 clients et des bases de quelques centaines de Mo, la mémoire du serveur s’épuise. Redémarrage = rechargement de tout. Pas de montée en charge horizontale réaliste. |
| **Solution** | À moyen terme : migrer vers un moteur SQLite **fichier** (ex. better-sqlite3) ou une base centralisée (PostgreSQL + schéma par tenant ou DB par tenant sur disque). Court terme : limiter le nombre de bases en cache (LRU), surveiller la RAM, documenter les limites (ex. max N tenants par instance). |
| **Priorité** | **Après MVP** (court terme : monitoring + limites) |

### 2.2 Pas de rotation / révocation fine des JWT

| Champ | Détail |
|-------|--------|
| **Niveau** | 🟠 **ÉLEVÉ** |
| **Où** | Auth |
| **Impact** | Un JWT valide reste utilisable jusqu’à expiration (ex. 15 min). Révoquer un utilisateur (licence, licenciement) ne révoque pas les tokens déjà émis avant la prochaine expiration. Les refresh tokens sont révocables (table), mais pas les access tokens. |
| **Solution** | Conserver la courte durée d’access token. Pour une révocation immédiate : (1) blacklist des JWT (par jti ou par user_id + issued_at) en cache/Redis, vérifiée dans le middleware ; ou (2) vérifier en base à chaque requête qu’un « revoked_before » n’a pas été mis à jour pour cet user (coût plus élevé). Documenter la procédure « révoquer utilisateur » (désactivation + invalidation refresh + éventuellement blacklist). |
| **Priorité** | **Après MVP** (ou avant prod si contrat exige révocation immédiate) |

### 2.3 Portail public / formulaire d’intervention sans tenant

| Champ | Détail |
|-------|--------|
| **Niveau** | 🟠 **ÉLEVÉ** (données + facturation) |
| **Où** | API publique – `/api/public/*` |
| **Impact** | Le formulaire public utilise `getDbForRequest(null)` → **une seule base** (default.db ou celle configurée). En multi-tenant, on ne sait pas **quel client** est servi. Risque : données d’un client exposées à un autre (mauvais domaine / lien), ou demandes enregistrées dans la mauvaise base. Facturation et support deviennent incohérents. |
| **Solution** | Lier le formulaire public à un tenant explicite : sous-domaine (ex. `client1.maintx.com`), token dans l’URL, ou paramètre signé. Résoudre le tenant côté serveur à partir de ce lien, puis utiliser **uniquement** la base de ce tenant pour équipements et création de demande. Refuser l’accès si tenant invalide ou suspendu. |
| **Priorité** | **Avant prod** si le formulaire public est utilisé en multi-tenant |

### 2.4 Sauvegardes non intégrées au déploiement

| Champ | Détail |
|-------|--------|
| **Niveau** | 🟠 **ÉLEVÉ** |
| **Où** | Infra / opérations |
| **Impact** | Le script `backup-tenant-bases.js` existe mais n’est pas déclenché automatiquement par l’app. Si personne ne configure un cron/Task Scheduler, **aucune sauvegarde**. Perte de données en cas de panne disque ou erreur humaine. |
| **Solution** | (1) Documenter clairement la planification (cron 1x/jour, rétention 7–30 j). (2) Idéalement : job intégré (ex. agenda/node-cron) qui lance la sauvegarde et log le résultat, ou script appelé par le scheduler du déploiement. (3) Alerter (log + optionnellement monitoring) si la sauvegarde échoue. (4) Procédure de test de restauration mensuelle (déjà documentée à faire). |
| **Priorité** | **Avant prod** (au moins planification + doc) |

### 2.5 Pas de limite de charge / rate limiting sur les routes métier

| Champ | Détail |
|-------|--------|
| **Niveau** | 🟠 **MOYEN** |
| **Où** | Infra / API |
| **Impact** | Seul le login est limité (ex. 10 req / 15 min par IP). Les routes métier (OT, équipements, rapports) sont sans limite. Un client abusif ou un script mal conçu peut saturer le serveur ou la base et dégrader le service pour tous. |
| **Solution** | Ajouter un rate limiter global par IP (et/ou par user_id si identifié) sur les routes authentifiées (ex. 200–500 req/min par IP, ajustable). En cas de dépassement : 429. Option : limite plus stricte sur les exports/rapports lourds. |
| **Priorité** | **Après MVP** (recommandé avant prod si trafic externe) |

---

## 3. Risques BUSINESS (facturation, licences, support, RGPD)

### 3.1 Licences : pas de lien explicite usage ↔ facturation

| Champ | Détail |
|-------|--------|
| **Niveau** | 🟠 **ÉLEVÉ** |
| **Où** | Modèle données / facturation |
| **Impact** | Les champs `license_start` / `license_end` et `status` permettent de bloquer l’accès, mais il n’y a pas de notion d’**usage mesuré** (nombre d’utilisateurs actifs, OT créées, etc.). Facturation au forfait ou à l’usage non automatisable. Litiges clients (« on paie pour 20 users, vous en avez 25 »). |
| **Solution** | Introduire des métriques d’usage (ex. nombre d’utilisateurs actifs par tenant, nombre d’OT par période) stockées ou agrégées (table `tenant_usage` ou logs). Exposer une API ou des jobs pour alimenter la facturation. Option : champs `max_users` / `max_sites` par tenant et vérification à la création (alerte ou blocage). |
| **Priorité** | **Après MVP** (ou avant prod si facturation au usage) |

### 3.2 Support : pas d’identifiant tenant dans les logs applicatifs

| Champ | Détail |
|-------|--------|
| **Niveau** | 🟠 **MOYEN** |
| **Où** | Logging |
| **Impact** | En cas d’incident, les logs (erreurs, requêtes) ne contiennent pas systématiquement le `tenant_id`. Le support doit deviner le client à partir de l’email ou de l’URL, ce qui ralentit le diagnostic et peut exposer le mauvais contexte. |
| **Solution** | Dans le middleware d’auth, attacher `req.tenantId` (et éventuellement `req.tenantName` ou slug) au contexte de log (ex. pour chaque requête authentifiée, logger ou faire remonter tenant_id dans un champ structuré). S’assurer que les erreurs 500 incluent le tenant dans le log (pas forcément dans la réponse client). |
| **Priorité** | **Après MVP** (recommandé avant prod pour support multi-tenant) |

### 3.3 RGPD : export / suppression des données à la demande

| Champ | Détail |
|-------|--------|
| **Niveau** | 🟠 **ÉLEVÉ** (légal) |
| **Où** | Données personnelles / processus |
| **Impact** | Un client ou un utilisateur peut demander l’**export** de ses données ou leur **suppression** (droit à l’effacement). Aujourd’hui : pas d’export structuré par tenant/utilisateur, et la suppression d’un tenant (soft delete) conserve les données. Risque de non-conformité RGPD et de réclamation. |
| **Solution** | (1) **Export :** Script ou API (admin MAINTX) qui exporte toutes les données d’un tenant (ou d’un user) dans un format structuré (JSON/CSV). (2) **Effacement :** Définir une procédure (délai après soft delete, purge physique, anonymisation des audit_logs si besoin). Documenter la politique de rétention et les procédures dans une notice / DPA. |
| **Priorité** | **Avant prod** si clients EU ou contrat l’exige ; sinon **après MVP** |

---

## 4. Scénarios CATASTROPHE réalistes

### 4.1 Incident client : un client signale « je ne vois plus mes données »

- **Causes possibles :** Tenant suspendu/expiré, licence_end dépassée, erreur de statut, base client corrompue ou fichier .db supprimé par erreur.
- **Prévention :** (1) Vérifier statut + licence au login (voir 1.3). (2) Messages d’erreur clairs (LICENSE_EXPIRED, TENANT_SUSPENDED, TENANT_DELETED). (3) Sauvegardes quotidiennes + test de restauration. (4) Procédure runbook : vérifier `tenants.status`, `license_end`, intégrité du fichier .db, restauration depuis backup si besoin.
- **Checklist :** Statut tenant cohérent partout (login + middleware) ; sauvegardes planifiées ; runbook documenté.

### 4.2 Panne disque ou corruption gmao.db

- **Impact :** Tous les clients et tous les utilisateurs sont injoignables. Indisponibilité totale.
- **Prévention :** (1) Health check incluant la DB (voir 1.5). (2) Sauvegardes automatiques de gmao.db (déjà dans backup script). (3) Redondance disque (RAID, volume cloud) et restauration testée. (4) Procédure de restauration depuis le dernier backup.
- **Checklist :** Health check DB ; backups quotidiens ; procédure de restauration et test mensuel.

### 4.3 Erreur humaine : suppression ou modification du mauvais tenant

- **Impact :** Données d’un client modifiées ou marquées supprimées par erreur. Perte de confiance, litige, possible perte de client.
- **Prévention :** (1) Confirmation explicite avant toute action destructive (suppression tenant, changement de licence). (2) Audit log déjà en place : vérifier que toutes les actions sensibles (tenant_updated, tenant_deleted, user créé avec tenant_id) sont tracées avec tenant_id et user_id. (3) Pas d’utilisation de `body.tenantId` pour les actions (voir 1.1). (4) Restauration depuis backup si erreur détectée à temps.
- **Checklist :** Suppression de l’usage de body.tenantId ; audit log complet ; confirmation côté UI pour actions critiques.

### 4.4 Fuite de données cross-tenant (exploitation d’un bug)

- **Impact :** Un client accède aux données d’un autre (OT, équipements, documents). Atteinte à la confidentialité, responsabilité juridique, perte de clients.
- **Prévention :** (1) Corriger les fuites identifiées (1.1, 1.2, 1.4). (2) Revue systématique : toute route qui lit/écrit en base doit utiliser soit `req.db` (déjà scopé au tenant par le middleware), soit `getAdminDb()` avec un filtre explicite `tenant_id = req.tenantId` (sauf routes MAINTX). (3) Tests d’isolation : scénarios où un user du tenant A tente d’accéder à une ressource du tenant B (IDs devinés).
- **Checklist :** Aucun tenantId depuis le client ; permissions/rôles réservés à MAINTX ; path traversal documents corrigé ; tests d’isolation.

---

## 5. Check-list de correction avant mise en production

À traiter **avant** de considérer la production comme sûre :

| # | Action | Fichier / zone |
|---|--------|----------------|
| 1 | Supprimer l’usage de `body.tenantId` pour l’affectation ; utiliser uniquement `req.tenantId` (sauf endpoint MAINTX dédié). | `technicians.js`, `users.js` |
| 2 | Protéger les routes de modification des rôles/permissions par `requireMaintxAdmin`. | `permissions.js` |
| 3 | Au login, vérifier `tenants.status` et `deleted_at` ; refuser 403 si suspended/expired/deleted. | `auth.js` |
| 4 | Sanitiser `entity_type` à l’upload ; valider `file_path` sous `uploadsDir` au download. | `documents.js` |
| 5 | Health check : test DB (et optionnel disque) ; retourner 503 si KO. | `server.js` |
| 6 | Si formulaire public utilisé en multi-tenant : lier la requête à un tenant (sous-domaine, token, param signé) et n’utiliser que la base de ce tenant. | `publicInterventionRequest.js`, config |
| 7 | Planifier les sauvegardes (cron/Task Scheduler) et documenter ; alerter en cas d’échec si possible. | Scripts, doc, déploiement |

À planifier **après MVP** (reste important) :

| # | Action |
|---|--------|
| 8 | Limiter/monitorer la RAM (nombre de bases en cache, LRU) ; documenter la limite de tenants par instance. |
| 9 | Révocation immédiate des JWT (blacklist ou vérification « revoked_before ») si exigée par contrat. |
| 10 | Rate limiting sur les routes métier (par IP et/ou par user). |
| 11 | Logging structuré avec `tenant_id` pour le support. |
| 12 | Métriques d’usage (users actifs, OT, etc.) pour facturation et limites. |
| 13 | Procédures RGPD : export et effacement des données par tenant/user. |

---

## 6. Synthèse

- **Critiques à traiter immédiatement :** Fuite cross-tenant via `body.tenantId` (users + techniciens), permissions modifiables par un admin client, login sans vérification du statut tenant, path traversal documents, health check sans DB.
- **Règle d’or déjà en place à conserver :** Tenant **uniquement** dérivé du JWT (user en base), middleware sur les routes métier, pas de confiance au frontend pour le scope des données. Les corrections ci-dessus renforcent cette règle et ferment les brèches restantes.
- **Scénarios catastrophe :** Réduits par les corrections critiques + sauvegardes planifiées + health check fiable + runbooks (incident client, panne, erreur humaine, fuite de données).

Ce document peut servir de base à une **revue de sécurité** formelle et à un **runbook** opérationnel pour la production.
