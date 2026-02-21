# Déploiement (VM / Linux)

## Option recommandée : tout lancer depuis le dossier `gmao`

Déployez le contenu du dossier **gmao** (avec son `package.json`, `backend/`, `frontend/`) sur le serveur, par ex. dans `/var/www/gmao`.

**Important :** ne pas avoir de `package.json` dans `/var/www`, sinon `npm install` lancé depuis `/var/www/gmao` tentera d’écrire dans `/var/www` (EACCES). Si vous en avez un, déplacez-le ou supprimez-le :
```bash
ls -la /var/www/package.json   # si présent :
sudo mv /var/www/package.json /var/www/package.json.bak
# ou supprimez-le s’il ne sert pas
```

```bash
# Droits : le user qui lance l'app doit posséder le dossier
sudo chown -R gmaouser:gmaouser /var/www/gmao
cd /var/www/gmao

# Installer les deps à la racine gmao (concurrently) + backend + frontend
npm install
cd backend && npm install && cd ../frontend && npm install
cd /var/www/gmao

# Lancer backend + frontend ensemble
npm run dev
```

Les scripts appellent `concurrently` et `nodemon` via `node node_modules/.../bin/...` pour éviter « Permission denied » sur les binaires.

## Port 5000 déjà utilisé

Si le backend affiche « Aucun port disponible entre 5000 et 5020 » :

```bash
# Voir quel processus utilise le port 5000
sudo lsof -i :5000
# ou
ss -tlnp | grep 5000

# Arrêter le processus (remplacer PID par le numéro affiché)
kill PID
```

Ou fixer le port dans `backend/.env` : `PORT=5001` (et adapter le proxy nginx si besoin).

## Lancer backend et frontend séparément

- **Backend :** `cd /var/www/gmao/backend && npm run dev`
- **Frontend (dev) :** `cd /var/www/gmao/frontend && npm run dev`

## Production (sans concurrently)

- **Backend :** `cd backend && npm start` (ou avec pm2/systemd)
- **Frontend :** servir le build après `cd frontend && npm run build` (nginx sert le dossier `dist/`)

---

## 403 Forbidden sur le login (POST /api/auth/login)

Si la connexion renvoie **403** alors que le backend ne renvoie jamais 403 pour le login, la réponse vient en général du **serveur web (nginx / Apache)** devant l’app.

À vérifier :

1. **Proxy /api**  
   Nginx doit faire un `proxy_pass` de `/api` vers le backend Node (port 5000 par défaut), **sans** bloquer les requêtes POST. Voir `nginx-example.conf` à la racine de `gmao`.

2. **Pas de blocage des requêtes**  
   Vérifier qu’il n’y a pas de règle du type `limit_except GET;` sur `/api` ni de WAF/ModSecurity qui bloquerait `POST /api/auth/login`.

3. **Tester le backend en direct**  
   Sur le serveur :  
   `curl -X POST http://127.0.0.1:5000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@xmaint.org","password":"votre_mot_de_passe"}'`  
   Si ça répond 200/401 (et pas 403), le souci vient bien du proxy.

Après modification de la config nginx :  
`sudo nginx -t && sudo systemctl reload nginx`
