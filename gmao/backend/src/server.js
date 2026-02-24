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
const exploitationRoutes = require('./routes/exploitation');
const partFamiliesRoutes = require('./routes/partFamilies');
const partCategoriesRoutes = require('./routes/partCategories');
const partSubFamiliesRoutes = require('./routes/partSubFamilies');
const brandsRoutes = require('./routes/brands');
const budgetsRoutes = require('./routes/budgets');
const externalContractorsRoutes = require('./routes/externalContractors');
const subcontractOrdersRoutes = require('./routes/subcontractOrders');
const trainingCatalogRoutes = require('./routes/trainingCatalog');
const trainingPlansRoutes = require('./routes/trainingPlans');
const satisfactionRoutes = require('./routes/satisfaction');
const rootCausesRoutes = require('./routes/rootCauses');
const workOrderTemplatesRoutes = require('./routes/workOrderTemplates');
const stockLocationsRoutes = require('./routes/stockLocations');
const stockReservationsRoutes = require('./routes/stockReservations');
const timeEntriesRoutes = require('./routes/timeEntries');
const attendanceOverridesRoutes = require('./routes/attendanceOverrides');
const presenceRoutes = require('./routes/presence');
const scheduledReportsRoutes = require('./routes/scheduledReports');
const stockBySiteRoutes = require('./routes/stockBySite');
const requiredDocumentTypesRoutes = require('./routes/requiredDocumentTypes');
const standardsRoutes = require('./routes/standards');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS : autoriser les applications externes (origine quelconque, credentials, en-têtes courants)
app.use(cors({
  origin: true,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));
app.use(express.json());

// Toutes les réponses /api en JSON
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Point d’entrée pour les applications externes : infos API (sans authentification)
app.get('/api', (req, res) => {
  res.json({
    name: 'GMAO / MAINTX API',
    version: '1.0',
    description: 'API REST pour la Gestion de Maintenance. Authentification requise (sauf /api/auth/login et /api/health).',
    documentation: '/api/openapi.json',
    integrationGuide: 'Voir docs/API_INTEGRATION_EXTERNE.md pour l\'intégration depuis applications externes.',
    auth: { type: 'Bearer JWT', login: 'POST /api/auth/login' },
    basePath: '/api'
  });
});

try {
  const openapi = require('./openapi.json');
  app.get('/api/openapi.json', (req, res) => res.json(openapi));
} catch (_) {}

// Éviter 404 sur favicon et requêtes Chrome DevTools
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => res.status(204).end());

// Page d'accueil API - redirection vers le frontend en dev
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
app.get('/', (req, res) => {
  res.redirect(302, FRONTEND_URL);
});

app.use('/api/auth', authRoutes);
const publicInterventionRequestRoutes = require('./routes/publicInterventionRequest');
app.use('/api/public', publicInterventionRequestRoutes);
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
app.use('/api/exploitation', exploitationRoutes);
app.use('/api/part-families', partFamiliesRoutes);
app.use('/api/part-categories', partCategoriesRoutes);
app.use('/api/part-sub-families', partSubFamiliesRoutes);
app.use('/api/brands', brandsRoutes);
app.use('/api/budgets', budgetsRoutes);
app.use('/api/external-contractors', externalContractorsRoutes);
app.use('/api/subcontract-orders', subcontractOrdersRoutes);
app.use('/api/training-catalog', trainingCatalogRoutes);
app.use('/api/training-plans', trainingPlansRoutes);
app.use('/api/satisfaction', satisfactionRoutes);
app.use('/api/root-causes', rootCausesRoutes);
app.use('/api/work-order-templates', workOrderTemplatesRoutes);
app.use('/api/stock-locations', stockLocationsRoutes);
app.use('/api/stock-reservations', stockReservationsRoutes);
app.use('/api/time-entries', timeEntriesRoutes);
app.use('/api/attendance-overrides', attendanceOverridesRoutes);
app.use('/api/presence', presenceRoutes);
app.use('/api/scheduled-reports', scheduledReportsRoutes);
app.use('/api/stock-by-site', stockBySiteRoutes);
app.use('/api/required-document-types', requiredDocumentTypesRoutes);
app.use('/api/standards', standardsRoutes);

// 404 pour toute requête /api non gérée (réponse JSON cohérente)
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ressource non trouvée', path: req.method + ' ' + req.path });
});

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

  // Migrations sur gmao.db : uniquement celles qui concernent la base admin (tenants, users.tenant_id).
  // Les autres migrations (sites, equipment, work_orders, etc.) s'appliquent à la base client (default.db) via runClientMigrations.
  const ADMIN_MIGRATIONS = ['026_tenants.js', '027_users_tenant_id.js', '028_tenants_license_dates.js'];
  try {
    const path = require('path');
    const fs = require('fs');
    const migrationsDir = path.join(__dirname, 'database/migrations');

    if (fs.existsSync(migrationsDir)) {
      for (const f of ADMIN_MIGRATIONS) {
        const fullPath = path.join(migrationsDir, f);
        if (!fs.existsSync(fullPath)) continue;
        try {
          const m = require(fullPath);
          if (m.up) {
            m.up(adminDb);
            console.log(`✅ Migration admin (gmao.db): ${f}`);
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
    console.warn('⚠️  Erreur lors des migrations admin:', err.message);
  }

  // gmao.db = base admin uniquement (tenants, abonnements). Données de test : tenant Démo + utilisateurs pour connexion.
  try {
    let tenantCount = 0;
    try {
      tenantCount = adminDb.prepare('SELECT COUNT(*) as c FROM tenants').get().c;
    } catch (_) {}
    if (tenantCount === 0) {
      const now = new Date();
      const licenseStart = now.toISOString().slice(0, 10);
      const licenseEnd = new Date(now.getFullYear() + 5, 11, 31).toISOString().slice(0, 10);
      adminDb.prepare(`
        INSERT INTO tenants (name, db_filename, email_domain, license_start, license_end)
        VALUES ('Démo', 'default.db', '@xmaint.org', ?, ?)
      `).run(licenseStart, licenseEnd);
      const tenantId = adminDb.prepare('SELECT id FROM tenants WHERE db_filename = ?').get('default.db').id;
      const roleIds = {};
      adminDb.prepare('SELECT id, name FROM roles').all().forEach(r => { roleIds[r.name] = r.id; });
      const pwdHash = bcrypt.hashSync('Password123!', 10);
      const demoUsers = [
        { email: 'responsable@xmaint.org', firstName: 'Jean', lastName: 'Responsable', role: 'responsable_maintenance' },
        { email: 'technicien@xmaint.org', firstName: 'Pierre', lastName: 'Technicien', role: 'technicien' },
        { email: 'user@xmaint.org', firstName: 'Marie', lastName: 'Utilisatrice', role: 'utilisateur' }
      ];
      try {
        const insUser = adminDb.prepare(`
          INSERT OR IGNORE INTO users (email, password_hash, first_name, last_name, role_id, is_active, tenant_id)
          VALUES (?, ?, ?, ?, ?, 1, ?)
        `);
        for (const u of demoUsers) {
          insUser.run(u.email, pwdHash, u.firstName, u.lastName, roleIds[u.role] || roleIds.utilisateur, tenantId);
        }
      } catch (_) {}
      adminDb._save();
      console.log('✅ Tenant Démo (default.db) et utilisateurs de test créés dans gmao.db');
    }
  } catch (errAdmin) {
    console.warn('⚠️  Seed admin (tenants):', errAdmin.message);
  }

  // Base client par défaut (démo) : schéma GMAO + données de test (sites, équipements, OT)
  try {
    const defaultDb = db.getClientDb(process.env.GMAO_DEFAULT_CLIENT_DB || 'default.db');
    db.ensureClientMigrations(defaultDb);
    let sitesCount = 0;
    try {
      sitesCount = defaultDb.prepare('SELECT COUNT(*) as c FROM sites').get().c;
    } catch (_) {}
    if (sitesCount === 0) {
      const seedModule = require('./database/seed');
      if (seedModule.runSeed) {
        await seedModule.runSeed(defaultDb);
        defaultDb._save();
        console.log('✅ Données de test GMAO chargées dans la base client (default.db)');
      }
    }
  } catch (errClient) {
    console.warn('⚠️  Base client démo:', errClient.message);
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

  // Job : rapports planifiés (toutes les heures, pour chaque base client)
  const scheduledReportsModule = require('./routes/scheduledReports');
  if (scheduledReportsModule.runScheduledReports) {
    setInterval(() => {
      try {
        const adminDb = db.getAdminDb();
        let tenants = [];
        try { tenants = adminDb.prepare('SELECT id FROM tenants').all(); } catch (_) {}
        for (const t of tenants) {
          try {
            const clientDb = db.getClientDb(t.id);
            scheduledReportsModule.runScheduledReports(clientDb, t.id);
          } catch (_) {}
        }
      } catch (_) {}
    }, 60 * 60 * 1000);
  }

  // Job : génération OT par compteur + alertes seuils (toutes les heures)
  const scheduledJobs = require('./services/scheduledJobs');
  if (scheduledJobs.runAll) {
    setInterval(() => {
      try {
        const adminDb = db.getAdminDb();
        let tenants = [];
        try { tenants = adminDb.prepare('SELECT id FROM tenants').all(); } catch (_) {}
        for (const t of tenants) {
          try {
            const clientDb = db.getClientDb(t.id);
            scheduledJobs.runAll(clientDb, t.id);
          } catch (_) {}
        }
      } catch (_) {}
    }, 60 * 60 * 1000);
  }
}

start().catch(err => {
  console.error('❌ Erreur démarrage:', err);
  process.exit(1);
});
