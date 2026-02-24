# Check-list de déploiement – GMAO Web (production)

**Objectif** : Vérifier que l’application est correctement configurée et déployée avant mise en production.

---

## 1. Variables d’environnement

### Backend (`gmao/backend/.env` ou variables serveur)
- [ ] **NODE_ENV** = `production`
- [ ] **PORT** = port d’écoute du serveur API (ex. 5000)
- [ ] **JWT_SECRET** = clé longue et aléatoire (générée, jamais la valeur par défaut)
- [ ] **JWT_EXPIRES_IN** = durée de validité des tokens (ex. `24h`)
- [ ] **GMAO_DB_PATH** = nom du fichier base admin (ex. `gmao.db`) ; le fichier est créé dans `gmao/backend/data/` (répertoire doit exister et être accessible en écriture)
- [ ] **FRONTEND_URL** = URL du frontend (pour redirection `GET /`)
- [ ] (Optionnel) **SMTP_*** / **TWILIO_***** si notifications email/SMS utilisées

### Frontend (build / serveur)
- [ ] **VITE_API_PORT** ou **API_URL** (si frontend appelle une API sur un autre port/hôte) : configurer selon l’environnement (proxy ou URL absolue) pour que les appels `/api` ciblent le bon backend.

---

## 2. Base de données SQLite

- [ ] Répertoire **gmao/backend/data/** créé et accessible en écriture par le processus Node
- [ ] Au premier démarrage : **init admin** exécuté (schéma admin + rôles + compte admin par défaut si aucun utilisateur)
- [ ] **Migrations admin** exécutées au démarrage (tenants, users.tenant_id, licence, etc.)
- [ ] **Migrations client** appliquées à l’ouverture de chaque base client (043–056 dans `db.js`)
- [ ] Sauvegarde régulière des fichiers `.db` (gmao.db + bases client par tenant) planifiée

---

## 3. Build & démarrage

### Backend
- [ ] `npm install` dans `gmao/backend`
- [ ] `node src/server.js` (ou `npm start`) démarre sans erreur
- [ ] Logs : “xmaint API démarrée sur …”, pas d’erreur de connexion DB
- [ ] **GET /api/health** retourne `{ "status": "ok", … }`
- [ ] **GET /api** retourne les infos API (sans auth)

### Frontend
- [ ] `npm install` dans `gmao/frontend`
- [ ] `npm run build` réussit sans erreur
- [ ] Fichiers de build générés (ex. `dist/`) servis par un serveur web (nginx, Apache, ou `npm run preview` pour test)
- [ ] Les requêtes `/api` sont proxyfiées ou pointent vers l’URL du backend (même origine ou CORS configuré)

---

## 4. Sécurité

- [ ] **JWT_SECRET** jamais la valeur par défaut en production
- [ ] Compte admin par défaut : mot de passe changé ou désactivé si non utilisé
- [ ] CORS : en production, restreindre `origin` si possible (au lieu de `origin: true`)
- [ ] Pas de logs sensibles (mots de passe, tokens) en production

---

## 5. Réseau & accès

- [ ] Port backend exposé uniquement aux clients autorisés (reverse proxy / firewall)
- [ ] HTTPS configuré en production (certificat sur reverse proxy ou Node)
- [ ] Frontend accessible à l’URL prévue ; redirection `GET /` vers le frontend (FRONTEND_URL) fonctionne

---

## 6. Vérifications fonctionnelles rapides

- [ ] **POST /api/auth/login** avec identifiants valides → 200 + token
- [ ] Requête authentifiée (ex. **GET /api/dashboard/kpis** avec `Authorization: Bearer <token>`) → 200
- [ ] Requête sans token ou token invalide → 401
- [ ] Création / modification / suppression d’une ressource (ex. OT, équipement) → comportement attendu et pas d’erreur 500 non gérée

---

## 7. Jobs planifiés (optionnel)

- [ ] Rapports planifiés (`scheduledReports.runScheduledReports`) : exécution périodique (ex. toutes les heures) sans erreur
- [ ] Jobs seuils / compteurs (`scheduledJobs.runAll`) : exécution périodique sans erreur

---

## 8. Documentation & suivi

- [ ] **docs/API_INTEGRATION_EXTERNE.md** disponible pour les intégrateurs
- [ ] **docs/AUDIT_PRODUCTION_GMAO.md** et **docs/CHECKLIST_DEPLOIEMENT.md** relus et appliqués
- [ ] Procédure de sauvegarde / restauration DB documentée
- [ ] Procédure de mise à jour (code + migrations) documentée

---

*Check-list à adapter selon l’hébergement (PM, cloud, Docker, etc.).*
