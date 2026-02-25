# Dépannage 502 Bad Gateway sur /api (login, refresh)

Un **502** signifie que nginx a bien reçu la requête mais n’a pas pu obtenir de réponse valide du backend Node. Voici quoi vérifier, dans l’ordre.

---

## 1. Le backend Node tourne-t-il ?

Sur le serveur :

```bash
# Processus node qui écoute
sudo ss -tlnp | grep 5000
# ou
sudo lsof -i :5000
```

- **Rien** → le backend n’écoute pas. Passez à l’étape 2.
- **Un process node** → le backend écoute. Passez à l’étape 3.

---

## 2. Installer les dépendances et démarrer le backend (port 5000)

**Important :** si vous avez une erreur `Cannot find module 'cookie-parser'` (ou autre module), exécutez d’abord `npm install` dans le dossier backend. Sur le serveur, depuis le dossier du projet (ex. `/var/www/gmao/gmao/backend`) :

```bash
cd /var/www/gmao/gmao/backend   # ou gmao/backend selon votre chemin
npm install                     # obligatoire si node_modules absent (ex. après déploiement)
# Avec les variables d’environnement (adapter le chemin du .env)
export NODE_ENV=production
export PORT=5000
# Optionnel : JWT, DB, etc.
# export JWT_SECRET=...
# export GMAO_DB_PATH=...

node src/server.js
```

Vérifier qu’il affiche par exemple :  
`xmaint API démarrée sur http://localhost:5000`  
et qu’il ne plante pas au démarrage (erreur DB, JWT, etc.).

En production, utilisez un gestionnaire de processus pour que le backend redémarre tout seul :

```bash
# Exemple avec PM2 (après avoir fait npm install une première fois)
npm install -g pm2
cd /var/www/gmao/gmao/backend
pm2 start src/server.js --name maintx-api
pm2 save
pm2 startup
```

Vérifier ensuite que le port 5000 est bien en écoute (étape 1).

---

## 3. Le backend écoute-t-il sur la bonne interface ?

Le backend doit écouter sur **127.0.0.1** ou **0.0.0.0** pour que nginx (sur la même machine) puisse s’y connecter.

Dans le code, Express fait `app.listen(PORT)` → par défaut il écoute sur toutes les interfaces (0.0.0.0). Donc normalement OK.

Si vous avez forcé `app.listen(PORT, '127.0.0.1')`, c’est bon aussi pour nginx en local.

---

## 4. Tester le backend en local (sans nginx)

Sur le serveur :

```bash
curl -X POST http://127.0.0.1:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"votre@email.com","password":"votremotdepasse"}'
```

- **Réponse JSON** (200 ou 401) → le backend répond. Le problème vient de nginx ou du chemin (étape 5).
- **Connection refused** → le backend ne tourne pas ou n’écoute pas sur 5000 (revoir étapes 1–2).
- **Timeout** → le backend bloque (crash, boucle, DB lente). Regarder les logs du process Node.

---

## 5. Vérifier les logs nginx

Les messages d’erreur nginx expliquent souvent le 502 :

```bash
sudo tail -50 /var/log/nginx/error.log
```

Exemples :

- **`connect() failed (111: Connection refused)`** → rien n’écoute sur 127.0.0.1:5000 → démarrer le backend (étape 2).
- **`upstream prematurely closed connection`** → le backend a fermé la connexion (crash ou erreur pendant la requête) → regarder les logs du backend.
- **`upstream timed out`** → le backend met trop de temps à répondre → augmenter `proxy_read_timeout` (déjà 60s dans la config) ou optimiser le backend.

---

## 6. Vérifier le port dans la config nginx

Dans `docs/nginx-maintx-ssl.conf` vous avez :

```nginx
location /api {
    proxy_pass http://127.0.0.1:5000;
    ...
}
```

Si le backend tourne sur un **autre port** (ex. 5001), modifier ici et recharger nginx :

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 7. Résumé des causes fréquentes

| Cause | Action |
|--------|--------|
| Backend non démarré | Démarrer avec `node src/server.js` ou PM2 (étape 2). |
| Backend sur un autre port | Adapter `proxy_pass` dans nginx ou la variable `PORT` du backend. |
| Backend qui crash au démarrage | Regarder la sortie console (DB manquante, JWT_SECRET, migration, etc.). |
| Backend qui crash sur /api/auth/login | Vérifier les logs Node au moment du 502 ; erreur dans le code auth ou la base. |
| Droits / répertoire data | Vérifier que le process Node peut lire/écrire le répertoire des bases (ex. `gmao/backend/data`). |

---

## 8. Checklist rapide

- [ ] `ss -tlnp \| grep 5000` montre un process en écoute
- [ ] `curl -X POST http://127.0.0.1:5000/api/auth/login ...` renvoie du JSON (pas « Connection refused »)
- [ ] `sudo tail /var/log/nginx/error.log` consulté après un 502
- [ ] Backend lancé avec un process manager (PM2, systemd) pour qu’il reste actif après déconnexion

Une fois le backend stable et répondant en local sur le port 5000, le 502 sur `https://maintx.org/api/auth/login` et `/api/auth/refresh` doit disparaître.
