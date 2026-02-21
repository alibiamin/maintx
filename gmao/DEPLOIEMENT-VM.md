# Lancer l'application GMAO dans une VM

Ce guide décrit comment installer et lancer l'application (backend + frontend) dans une machine virtuelle, en mode développement ou en mode production.

---

## Prérequis sur la VM

- **Node.js** 18+ (recommandé LTS)  
  Vérifier : `node -v` et `npm -v`
- **Git** (optionnel, si vous clonez le dépôt)

Sous Ubuntu/Debian :
```bash
sudo apt update
sudo apt install -y nodejs npm
# ou avec nvm : curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash && nvm install 18
```

Sous Windows (PowerShell en admin) :
- Télécharger Node.js LTS depuis https://nodejs.org et l'installer.

---

## Structure sur le serveur

Quand vous déployez **uniquement le contenu du dossier `gmao`** dans `/var/www/gmao`, vous devez avoir :

- `/var/www/gmao/package.json`
- `/var/www/gmao/dev-runner.js`  ← **à ne pas oublier**
- `/var/www/gmao/backend/`
- `/var/www/gmao/frontend/`

Si `dev-runner.js` manque, créez-le (voir section ci-dessous).

---

## Créer `dev-runner.js` sur le serveur (si absent)

Sur la VM, créez le fichier :

```bash
nano /var/www/gmao/dev-runner.js
```

Collez exactement ce contenu, puis enregistrez (Ctrl+O, Entrée, Ctrl+X) :

```javascript
#!/usr/bin/env node
const path = require('path');
const { spawn } = require('child_process');

const root = __dirname;
const colors = { back: '\x1b[34m', front: '\x1b[32m', reset: '\x1b[0m' };

function run(name, cmd, args, cwd) {
  const c = colors[name] || '';
  const child = spawn(cmd, args, {
    cwd: path.join(root, cwd),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (d) => process.stdout.write(`${c}[${name}] ${d}${colors.reset}`));
  child.stderr.on('data', (d) => process.stderr.write(`${c}[${name}] ${d}${colors.reset}`));
  child.on('error', (err) => console.error(`[${name}] error:`, err));
  child.on('exit', (code) => code !== null && code !== 0 && process.exit(code));
  return child;
}

console.log('Starting backend and frontend...\n');
run('back', process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], 'backend');
run('front', process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], 'frontend');
```

---

## 1. Préparer le projet

Copier le dossier du projet sur la VM (partage de fichiers, SCP, clone Git, etc.), puis :

```bash
cd /var/www/gmao
npm run install:all
```

Cela installe les dépendances du **backend** et du **frontend**.

---

## 2. Configurer le backend

Créer le fichier `.env` à partir de l'exemple :

```bash
cd /var/www/gmao/backend
cp .env.example .env
```

Éditer `backend/.env` et adapter au minimum :

- `PORT=5000` (garder 5000 si vous n'utilisez pas nginx)
- `JWT_SECRET` : mettre une clé longue et aléatoire en production
- `DATABASE_PATH=./data/xmaint.db` (par défaut, SQLite dans `backend/data/`)

Initialiser la base et (optionnel) les données de démo :

```bash
cd /var/www/gmao/backend
npm run init-db
npm run seed
```

---

## 3. Lancer l'application

### Option A : Mode développement (recommandé pour tester)

À la racine du projet (là où se trouvent `backend/`, `frontend/` et `dev-runner.js`) :

```bash
cd /var/www/gmao
node dev-runner.js
```

Ou : `npm run dev`

- **Backend** : http://localhost:5000  
- **Frontend** : http://localhost:3000  

Ouvrir dans le navigateur : **http://localhost:3000** (ou l'IP de la VM, voir ci‑dessous).

### Option B : Sans dev-runner.js (dépannage)

Si `dev-runner.js` n'est pas disponible, lancez backend et frontend dans **deux terminaux** :

**Terminal 1 – Backend :**
```bash
cd /var/www/gmao/backend
npm run dev
```

**Terminal 2 – Frontend :**
```bash
cd /var/www/gmao/frontend
npm run dev
```

### Option C : Mode production (build + serve)

1. **Build du frontend** (en UTF-8 pour que les accents s'affichent correctement)
   ```bash
   cd /var/www/gmao/frontend
   # Avec locale UTF-8 (évite "Accdez" au lieu de "Accédez à")
   export LC_ALL=en_US.UTF-8
   npm run build
   ```
   Ou utiliser le script fourni : `chmod +x build-utf8.sh && ./build-utf8.sh`  
   Les fichiers statiques sont dans `frontend/dist/`.

2. **Servir le frontend**
   - Soit avec **nginx** (voir section 4), en pointant la racine vers `frontend/dist` et en proxyfiant `/api` vers `http://127.0.0.1:5000`.
   - Soit avec un serveur Node (express static) en plus du backend.

3. **Lancer le backend**
   ```bash
   cd /var/www/gmao/backend
   npm run start
   ```
   Le backend écoute sur le port défini dans `.env` (ex. 5000).

En production, utilisez un gestionnaire de processus (PM2, systemd) pour garder le backend actif.

---

## 4. Accéder depuis l'extérieur (autre machine / réseau)

- **Firewall** : ouvrir les ports **3000** (dev frontend) et **5000** (backend).  
  Exemple Linux :
  ```bash
  sudo ufw allow 3000
  sudo ufw allow 5000
  sudo ufw reload
  ```
- **Adresse** : utiliser l'IP de la VM au lieu de `localhost`, ex. `http://192.168.1.100:3000`.

En **mode production** avec nginx sur le port 80, ouvrir le port 80 et accéder via `http://<IP-VM>`.

---

## 5. Exemple nginx (production)

Le fichier `nginx-example.conf` montre comment :

- Servir le frontend depuis `frontend/dist`
- Proxifier `/api` vers le backend Node (port 5000)

Adapter les chemins et `server_name`, puis :

```bash
sudo cp nginx-example.conf /etc/nginx/sites-available/gmao
sudo ln -s /etc/nginx/sites-available/gmao /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Dans la config nginx, ajouter **`charset utf-8;`** dans le bloc `server` pour que le navigateur interprète les pages en UTF-8 (voir `nginx-example.conf`).

---

## 5b. Accents mal affichés sur la VM (Accdez au lieu de Accédez à)

Si les textes s'affichent correctement en local mais pas sur la VM (caractères cassés, « Accdez » au lieu de « Accédez à »), faire les trois points suivants.

1. **Locale UTF-8 sur la VM** (une fois) :
   ```bash
   sudo apt install -y locales
   sudo locale-gen en_US.UTF-8
   sudo update-locale LANG=en_US.UTF-8
   # Puis se reconnecter en SSH ou faire : export LANG=en_US.UTF-8
   ```

2. **Rebuild du frontend en UTF-8** (à chaque déploiement) :
   ```bash
   cd /var/www/gmao/frontend
   export LC_ALL=en_US.UTF-8
   npm run build
   ```
   Ou : `chmod +x build-utf8.sh && ./build-utf8.sh`

3. **Nginx** : dans le bloc `server`, ajouter `charset utf-8;` puis `sudo nginx -t && sudo systemctl reload nginx`.

---

## 6. Garder l'application toujours active (PM2 ou systemd)

En production, le **frontend** est servi par nginx (fichiers statiques). Il faut garder uniquement le **backend** Node toujours actif, y compris après déconnexion SSH et après redémarrage de la VM.

### Option recommandée : PM2

1. **Installer PM2** (une fois sur la VM) :
   ```bash
   sudo npm install -g pm2
   ```

2. **Démarrer le backend** avec le fichier de config du projet :
   ```bash
   cd /var/www/gmao
   pm2 start ecosystem.config.cjs
   ```

3. **Sauvegarder la liste des processus** et **activer le démarrage au boot** :
   ```bash
   pm2 save
   pm2 startup
   ```
   Exécutez la commande que `pm2 startup` affiche (souvent `sudo env PATH=... pm2 startup systemd -u root --hp /root`).

4. **Commandes utiles** :
   ```bash
   pm2 status          # voir le statut
   pm2 logs gmao-api   # voir les logs
   pm2 restart gmao-api
   pm2 stop gmao-api
   ```

### Alternative : systemd

Si vous préférez un service systemd sans PM2 :

1. Créer le fichier service :
   ```bash
   sudo nano /etc/systemd/system/gmao-api.service
   ```

2. Contenu (adapter `User` si besoin) :
   ```ini
   [Unit]
   Description=GMAO API Backend
   After=network.target

   [Service]
   Type=simple
   User=root
   WorkingDirectory=/var/www/gmao/backend
   ExecStart=/usr/bin/node src/server.js
   Restart=on-failure
   RestartSec=5
   Environment=NODE_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```

3. Activer et démarrer :
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable gmao-api
   sudo systemctl start gmao-api
   sudo systemctl status gmao-api
   ```

---

## Récapitulatif rapide (mode dev dans la VM)

```bash
cd /var/www/gmao
# Si dev-runner.js manque, le créer (voir section "Créer dev-runner.js")
npm run install:all
cd backend && cp .env.example .env && npm run init-db && npm run seed && cd ..
node dev-runner.js
```

Puis ouvrir **http://localhost:3000** (ou http://&lt;IP-de-la-VM&gt;:3000).
