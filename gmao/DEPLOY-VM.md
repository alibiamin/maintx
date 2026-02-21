# Déploiement sur la VM (après git pull)

Après un `git pull` sur la VM, pour que les nouvelles fonctionnalités (ex. **Performance des techniciens**) apparaissent :

## 1. Rebuild du frontend

Le frontend est servi en fichiers compilés. Il faut reconstruire le bundle :

```bash
cd gmao/frontend
npm ci --omit=optional    # ou npm install si pas de lockfile
./build-utf8.sh           # ou : npm run build
```

## 2. Redémarrage du backend

Le serveur Node doit recharger le code (nouvelles routes, ex. `/api/dashboard/technician-performance`) :

```bash
cd gmao/backend
# Selon votre setup, par exemple :
pm2 restart gmao          # si vous utilisez pm2
# ou redémarrer le processus node qui sert l'API
```

## 3. Cache navigateur

En cas de doute, recharger la page en **vidant le cache** (Ctrl+Shift+R ou Cmd+Shift+R) pour charger le nouveau JavaScript.

---

**Résumé** : après `git pull`, exécuter **build frontend** + **restart backend** sur la VM.
