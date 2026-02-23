/**
 * xmaint Backend - Serveur Express (maintx.org)
 * API REST pour la Gestion de Maintenance
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
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
const auditRoutes = require('./routes/audit');
const maintenanceProjectsRoutes = require('./routes/maintenanceProjects');
const equipmentModelsRoutes = require('./routes/equipmentModels');
const proceduresRoutes = require('./routes/procedures');
const tenantsRoutes = require('./routes/tenants');

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
app.use('/api/audit', auditRoutes);
app.use('/api/maintenance-projects', maintenanceProjectsRoutes);
app.use('/api/equipment-models', equipmentModelsRoutes);
app.use('/api/procedures', proceduresRoutes);
app.use('/api/tenants', tenantsRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Erreur serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Schéma minimal pour la base admin (xmaint.db) : roles + users (requis pour le login)
const ADMIN_BASE_SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

function ensureDefaultAdmin(adminDb) {
  const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin123!';
  const hash = bcrypt.hashSync(defaultPassword, 10);
  const adminRoleId = adminDb.prepare("SELECT id FROM roles WHERE name = 'administrateur'").get().id;
  adminDb.prepare(`
    INSERT INTO users (email, password_hash, first_name, last_name, role_id, is_active)
    VALUES (?, ?, 'Admin', 'xmaint', ?, 1)
  `).run('admin@xmaint.org', hash, adminRoleId);
  adminDb._save();
  console.log('✅ Compte admin par défaut créé : admin@xmaint.org / ' + (process.env.DEFAULT_ADMIN_PASSWORD ? '***' : 'Admin123!'));
}

function ensureAdminBaseSchema(adminDb) {
  let tablesCreated = false;
  try {
    adminDb.prepare('SELECT 1 FROM users LIMIT 1').get();
  } catch (e) {
    if (!e.message || !e.message.includes('no such table')) throw e;
    adminDb.exec(ADMIN_BASE_SCHEMA);
    tablesCreated = true;
  }
  const roleCount = adminDb.prepare('SELECT COUNT(*) as c FROM roles').get();
  if (roleCount && roleCount.c === 0) {
    adminDb.prepare("INSERT INTO roles (name, description) VALUES ('administrateur', 'Administrateur système')").run();
    adminDb.prepare("INSERT INTO roles (name, description) VALUES ('responsable_maintenance', 'Responsable maintenance')").run();
    adminDb.prepare("INSERT INTO roles (name, description) VALUES ('technicien', 'Technicien')").run();
    adminDb.prepare("INSERT INTO roles (name, description) VALUES ('utilisateur', 'Utilisateur')").run();
    adminDb._save();
    if (tablesCreated) console.log('✅ Schéma admin (roles, users) créé sur xmaint.db');
    ensureDefaultAdmin(adminDb);
    return;
  }
  const userCount = adminDb.prepare('SELECT COUNT(*) as c FROM users').get();
  if (userCount && userCount.c === 0) {
    ensureDefaultAdmin(adminDb);
  }
}

async function start() {
  await db.init();
  const adminDb = db.getAdminDb();
  ensureAdminBaseSchema(adminDb);

  // Migrations sur gmao.db (tenants, users.tenant_id, etc.)
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
            m.up(adminDb);
            console.log(`✅ Migration appliquée: ${f}`);
          }
        } catch (err) {
          if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
            console.warn(`⚠️  Migration ${f}: ${err.message}`);
          }
        }
      }
      adminDb._save();
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
