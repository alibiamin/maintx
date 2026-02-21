/**
 * PM2 - Garder le backend GMAO toujours actif et au redémarrage de la VM.
 * Usage sur le serveur :
 *   cd /var/www/gmao && pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup   # pour relancer au boot
 */
module.exports = {
  apps: [
    {
      name: 'gmao-api',
      cwd: './backend',
      script: 'src/server.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: { NODE_ENV: 'production' }
    }
  ]
};
