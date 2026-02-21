/**
 * xmaint Backend - Serveur Express (maintx.org)
 * API REST pour la Gestion de Maintenance
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./database/db');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const equipmentRoutes = require('./routes/equipment');
const workOrdersRoutes = require('./routes/workOrders');
const maintenancePlansRoutes = require('./routes/maintenancePlans');
const stockRoutes = require('./routes/stock');
const suppliersRoutes = require('./routes/suppliers');
const usersRoutes = require('./routes/users');
const reportsRoutes = require('./routes/reports');
const sitesRoutes = require('./routes/sites');
const failureCodesRoutes = require('./routes/failureCodes');
const settingsRoutes = require('./routes/settings');
const documentsRoutes = require('./routes/documents');
const contractsRoutes = require('./routes/contracts');
const alertsRoutes = require('./routes/alerts');
const checklistsRoutes = require('./routes/checklists');
const toolsRoutes = require('./routes/tools');
const planningRoutes = require('./routes/planning');
const techniciansRoutes = require('./routes/technicians');
const competenciesRoutes = require('./routes/competencies');
const notificationsRoutes = require('./routes/notifications');
const searchRoutes = require('./routes/search');
const interventionRequestsRoutes = require('./routes/interventionRequests');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Éviter 404 sur favicon et requêtes Chrome DevTools
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => res.status(204).end());

// Page d'accueil API - redirection vers le frontend en dev
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
app.get('/', (req, res) => {
  res.redirect(302, FRONTEND_URL);
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/work-orders', workOrdersRoutes);
app.use('/api/maintenance-plans', maintenancePlansRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api', sitesRoutes);
app.use('/api/failure-codes', failureCodesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/checklists', checklistsRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api/planning', planningRoutes);
app.use('/api/technicians', techniciansRoutes);
app.use('/api/competencies', competenciesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/intervention-requests', interventionRequestsRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Erreur serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

async function start() {
  await db.init();
  
  // Exécuter automatiquement les migrations si nécessaire
  try {
    const path = require('path');
    const fs = require('fs');
    const migrationsDir = path.join(__dirname, 'database/migrations');
    
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.js'))
        .sort();
      
      for (const f of files) {
        try {
          const m = require(path.join(migrationsDir, f));
          if (m.up) {
            m.up(db);
            console.log(`✅ Migration appliquée: ${f}`);
          }
        } catch (err) {
          // Ignorer les erreurs de table déjà existante
          if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
            console.warn(`⚠️  Migration ${f}: ${err.message}`);
          }
        }
      }
      db._save();
    }
  } catch (err) {
    console.warn('⚠️  Erreur lors de l\'exécution automatique des migrations:', err.message);
  }
  
  function listen(port) {
    const server = app.listen(port, () => {
      console.log(`\n🚀 xmaint API démarrée sur http://localhost:${server.address().port}`);
      if (port !== (parseInt(process.env.PORT, 10) || 5000)) {
        console.log(`   ⚠️  Port 5000 occupé → utilisation du port ${port}`);
        console.log(`   Pour que le frontend appelle l'API : créez frontend/.env avec : VITE_API_PORT=${port}`);
      }
      console.log(`   Environnement: ${process.env.NODE_ENV || 'development'}`);
      console.log(`\n   Endpoints principaux:`);
      console.log(`   - POST /api/auth/login`);
      console.log(`   - GET  /api/dashboard/kpis`);
      console.log(`   - GET  /api/equipment`);
      console.log(`   - GET  /api/work-orders`);
      console.log(`   - GET  /api/stock/parts`);
      console.log(`   - GET  /api/suppliers`);
      console.log('');
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        const nextPort = port + 1;
        if (nextPort <= 5010) {
          console.warn(`\n⚠️  Port ${port} déjà utilisé, tentative sur le port ${nextPort}...`);
          listen(nextPort);
        } else {
          console.error(`\n❌ Aucun port disponible entre ${PORT} et 5010. Fermez l'application qui utilise le port ${port}.`);
          process.exit(1);
        }
      } else {
        console.error('❌ Erreur serveur:', err);
        process.exit(1);
      }
    });
  }

  listen(PORT);
}

start().catch(err => {
  console.error('❌ Erreur démarrage:', err);
  process.exit(1);
});
