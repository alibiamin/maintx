/**
 * Script de peuplement initial - Données de démo et utilisateurs
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
const dbPath = process.env.GMAO_DB_PATH || path.join(dataDir, 'gmao.db');

async function seed() {
  const dbModule = require('./db');
  await dbModule.init();
  const targetDb = dbModule.getAdminDb();
  if (!fs.existsSync(targetDb.getPath ? targetDb.getPath() : dbPath)) {
    console.error('❌ Base de données non trouvée. Exécutez: npm run init-db puis npm run migrate');
    process.exit(1);
  }

  console.log('🌱 Peuplement de la base de données (gmao.db)...');

  await runSeed(targetDb);
  dbModule.close();
  process.exit(0);
}

/** Crée part_families et brands si absents (base client peut ne pas avoir 039 selon ordre migrations) */
function ensurePartFamiliesAndBrands(db) {
  try {
    db.prepare('SELECT 1 FROM part_families LIMIT 1').get();
  } catch (e) {
    if (e.message && e.message.includes('no such table')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS part_families (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS brands (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      if (db._save) db._save();
    }
  }
}

async function runSeed(db) {
  ensurePartFamiliesAndBrands(db);

  const roles = [
    { name: 'administrateur', description: 'Accès complet au système' },
    { name: 'responsable_maintenance', description: 'Gestion des équipes et ordres de travail' },
    { name: 'technicien', description: 'Exécution des interventions' },
    { name: 'utilisateur', description: 'Consultation et déclaration de pannes' }
  ];

  for (const r of roles) {
    db.prepare('INSERT OR IGNORE INTO roles (name, description) VALUES (?, ?)').run(r.name, r.description);
  }

  const roleIds = {};
  db.prepare('SELECT id, name FROM roles').all().forEach(r => { roleIds[r.name] = r.id; });

  const passwordHash = await bcrypt.hash('Password123!', 10);
  const users = [
    { email: 'admin@xmaint.org', firstName: 'Admin', lastName: 'Système', role: 'administrateur' },
    { email: 'responsable@xmaint.org', firstName: 'Jean', lastName: 'Responsable', role: 'responsable_maintenance' },
    { email: 'technicien@xmaint.org', firstName: 'Pierre', lastName: 'Technicien', role: 'technicien' },
    { email: 'user@xmaint.org', firstName: 'Marie', lastName: 'Utilisatrice', role: 'utilisateur' },
    { email: 'technicien2@xmaint.org', firstName: 'Sophie', lastName: 'Martin', role: 'technicien' },
    { email: 'technicien3@xmaint.org', firstName: 'Lucas', lastName: 'Bernard', role: 'technicien' }
  ];

  for (const u of users) {
    db.prepare('INSERT OR IGNORE INTO users (email, password_hash, first_name, last_name, role_id) VALUES (?, ?, ?, ?, ?)')
      .run(u.email, passwordHash, u.firstName, u.lastName, roleIds[u.role]);
  }

  // Taux horaires pour coûts main d'œuvre (techniciens et responsable)
  try {
    const techRoleId = roleIds['technicien'];
    const respRoleId = roleIds['responsable_maintenance'];
    if (techRoleId) db.prepare('UPDATE users SET hourly_rate = 42 WHERE role_id = ?').run(techRoleId);
    if (respRoleId) db.prepare('UPDATE users SET hourly_rate = 52 WHERE role_id = ?').run(respRoleId);
  } catch (e) {
    if (!e.message?.includes('no such column')) console.warn('hourly_rate:', e.message);
  }

  const woTypes = [
    { name: 'Préventif', color: '#4caf50' },
    { name: 'Correctif', color: '#f44336' },
    { name: 'Inspection', color: '#2196f3' },
    { name: 'Amélioration', color: '#ff9800' }
  ];
  for (const t of woTypes) {
    db.prepare('INSERT OR IGNORE INTO work_order_types (name, color) VALUES (?, ?)').run(t.name, t.color);
  }

  // Sites et Lignes
  db.prepare("INSERT OR IGNORE INTO sites (code, name, address) VALUES ('SITE-01', 'Usine principale', 'Zone industrielle')").run();
  const siteId = db.prepare('SELECT id FROM sites WHERE code = ?').get('SITE-01')?.id;
  if (siteId) {
    db.prepare('INSERT OR IGNORE INTO lignes (site_id, code, name) VALUES (?, ?, ?)').run(siteId, 'L1', 'Ligne assemblage');
    db.prepare('INSERT OR IGNORE INTO lignes (site_id, code, name) VALUES (?, ?, ?)').run(siteId, 'L2', 'Ligne conditionnement');
  }
  const ligneIds = db.prepare('SELECT id, code FROM lignes').all().reduce((acc, r) => { acc[r.code] = r.id; return acc; }, {});

  // Étape 1 : Départements (si table existe) + second site
  try {
    db.prepare("INSERT OR IGNORE INTO sites (code, name, address) VALUES ('SITE-02', 'Entrepôt logistique', 'Avenue des Chênes')").run();
    const site2Id = db.prepare('SELECT id FROM sites WHERE code = ?').get('SITE-02')?.id;
    if (siteId) {
      db.prepare('INSERT OR IGNORE INTO departements (site_id, code, name, description) VALUES (?, ?, ?, ?)')
        .run(siteId, 'DEP-PROD', 'Production', 'Ateliers de production');
      db.prepare('INSERT OR IGNORE INTO departements (site_id, code, name, description) VALUES (?, ?, ?, ?)')
        .run(siteId, 'DEP-ENERGIE', 'Énergie & fluides', 'Transformateurs, pompes');
    }
    if (site2Id) {
      db.prepare('INSERT OR IGNORE INTO departements (site_id, code, name, description) VALUES (?, ?, ?, ?)')
        .run(site2Id, 'DEP-LOG', 'Logistique', 'Convoyeurs et stockage');
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Départements:', e.message);
  }
  const depIds = {};
  try {
    db.prepare('SELECT id, code FROM departements').all().forEach(r => { depIds[r.code] = r.id; });
  } catch (e) {}

  const categories = [
    { name: 'Machines de production', parent: null },
    { name: 'Équipements électriques', parent: null },
    { name: 'Pompes et compresseurs', parent: null }
  ];
  for (const c of categories) {
    db.prepare('INSERT OR IGNORE INTO equipment_categories (name, parent_id) VALUES (?, ?)').run(c.name, c.parent);
  }

  const catIds = db.prepare('SELECT id, name FROM equipment_categories').all()
    .reduce((acc, r) => { acc[r.name] = r.id; return acc; }, {});

  const equipment = [
    { code: 'EQ-001', name: 'Presse hydraulique P500', category: 'Machines de production', serial: 'PH-2020-001', criticite: 'A', ligne: 'L1', dep: 'DEP-PROD', type: 'machine' },
    { code: 'EQ-002', name: 'Convoyeur principal', category: 'Machines de production', serial: 'CV-2019-045', criticite: 'A', ligne: 'L1', dep: 'DEP-PROD', type: 'machine' },
    { code: 'EQ-003', name: 'Transformateur 1000kVA', category: 'Équipements électriques', serial: 'TR-2021-012', criticite: 'A', ligne: null, dep: 'DEP-ENERGIE', type: 'machine' },
    { code: 'EQ-004', name: 'Pompe centrifuge PC-200', category: 'Pompes et compresseurs', serial: 'PC-2020-033', criticite: 'B', ligne: 'L2', dep: 'DEP-ENERGIE', type: 'machine' }
  ];

  const insEq = db.prepare(`
    INSERT OR IGNORE INTO equipment (code, name, category_id, ligne_id, serial_number, criticite, status, department_id, equipment_type)
    VALUES (?, ?, ?, ?, ?, ?, 'operational', ?, ?)
  `);
  for (const e of equipment) {
    try {
      insEq.run(
        e.code, e.name, catIds[e.category] || 1, e.ligne ? ligneIds[e.ligne] : null, e.serial, e.criticite || 'B',
        e.dep ? depIds[e.dep] : null, e.type || 'machine'
      );
    } catch (err) {
      db.prepare("INSERT OR IGNORE INTO equipment (code, name, category_id, ligne_id, serial_number, criticite, status) VALUES (?, ?, ?, ?, ?, ?, 'operational')")
        .run(e.code, e.name, catIds[e.category] || 1, e.ligne ? ligneIds[e.ligne] : null, e.serial, e.criticite || 'B');
    }
  }

  // Mise à jour des équipements existants (department_id, equipment_type) si colonnes présentes
  try {
    const updDept = db.prepare('UPDATE equipment SET department_id = ?, equipment_type = ? WHERE code = ?');
    equipment.forEach(e => {
      if (e.dep && depIds[e.dep]) updDept.run(depIds[e.dep], e.type || 'machine', e.code);
    });
    db._save();
  } catch (_) {}

  // Helper : insérer un équipement enfant (section, composant, sous_composant)
  const catDefault = catIds['Machines de production'] || 1;
  function insertChild(code, name, equipmentType, parentId) {
    try {
      db.prepare(`
        INSERT OR IGNORE INTO equipment (code, name, category_id, parent_id, criticite, status, equipment_type)
        VALUES (?, ?, ?, ?, 'B', 'operational', ?)
      `).run(code, name, catDefault, parentId, equipmentType);
      return db.prepare('SELECT id FROM equipment WHERE code = ?').get(code)?.id;
    } catch (e) {
      return null;
    }
  }

  // ——— Hiérarchie complète : Machine → Section → Composant → Sous-composant ———

  // EQ-001 Presse hydraulique : Sections → Composants → Sous-composants
  const eq001 = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-001');
  if (eq001) {
    const m1 = eq001.id;
    const s1_1 = insertChild('EQ-001-S1', 'Bloc hydraulique', 'section', m1);
    const s1_2 = insertChild('EQ-001-S2', 'Table de travail', 'section', m1);
    if (s1_1) {
      const c1 = insertChild('EQ-001-S1-C1', 'Pompe hydraulique', 'composant', s1_1);
      if (c1) {
        insertChild('EQ-001-S1-C1-SC1', 'Filtre hydraulique', 'sous_composant', c1);
        insertChild('EQ-001-S1-C1-SC2', 'Joint d\'étanchéité pompe', 'sous_composant', c1);
      }
      const c2 = insertChild('EQ-001-S1-C2', 'Réservoir huile', 'composant', s1_1);
      if (c2) insertChild('EQ-001-S1-C2-SC1', 'Niveau à voyant', 'sous_composant', c2);
    }
    if (s1_2) {
      insertChild('EQ-001-S2-C1', 'Plateau de travail', 'composant', s1_2);
      const c2 = insertChild('EQ-001-S2-C2', 'Guidage linéaire', 'composant', s1_2);
      if (c2) insertChild('EQ-001-S2-C2-SC1', 'Glissière à billes', 'sous_composant', c2);
    }
    const cyl = insertChild('EQ-001-C0', 'Cylindre principal', 'composant', m1);
    if (cyl) {
      insertChild('EQ-001-C0-SC1', 'Joint piston', 'sous_composant', cyl);
      insertChild('EQ-001-C0-SC2', 'Tige cylindre', 'sous_composant', cyl);
    }
  }

  // EQ-002 Convoyeur : Sections → Composants → Sous-composants
  const eq002 = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-002');
  if (eq002) {
    const m2 = eq002.id;
    const s1 = insertChild('EQ-002-S1', 'Moteur et réducteur', 'section', m2);
    const s2 = insertChild('EQ-002-S2', 'Bande transporteuse', 'section', m2);
    if (s1) {
      insertChild('EQ-002-S1-C1', 'Moteur électrique', 'composant', s1);
      const red = insertChild('EQ-002-S1-C2', 'Réducteur', 'composant', s1);
      if (red) insertChild('EQ-002-S1-C2-SC1', 'Courroie de transmission', 'sous_composant', red);
    }
    if (s2) {
      insertChild('EQ-002-S2-C1', 'Tapis caoutchouc', 'composant', s2);
      const roul = insertChild('EQ-002-S2-C2', 'Rouleaux porteurs', 'composant', s2);
      if (roul) insertChild('EQ-002-S2-C2-SC1', 'Roulement rouleau', 'sous_composant', roul);
    }
  }

  // EQ-003 Transformateur : Sections → Composants
  const eq003 = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-003');
  if (eq003) {
    const m3 = eq003.id;
    const s1 = insertChild('EQ-003-S1', 'Cuve et bobinage', 'section', m3);
    const s2 = insertChild('EQ-003-S2', 'Commutation', 'section', m3);
    if (s1) insertChild('EQ-003-S1-C1', 'Bobinage HT', 'composant', s1);
    if (s2) {
      insertChild('EQ-003-S2-C1', 'Disjoncteur', 'composant', s2);
      insertChild('EQ-003-S2-C2', 'Relais thermique', 'composant', s2);
    }
  }

  // EQ-004 Pompe centrifuge : Sections → Composants → Sous-composants
  const eq004 = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-004');
  if (eq004) {
    const m4 = eq004.id;
    const s1 = insertChild('EQ-004-S1', 'Corps de pompe', 'section', m4);
    const s2 = insertChild('EQ-004-S2', 'Moteur', 'section', m4);
    if (s1) {
      insertChild('EQ-004-S1-C1', 'Roue à aube', 'composant', s1);
      const arbre = insertChild('EQ-004-S1-C2', 'Arbre', 'composant', s1);
      if (arbre) insertChild('EQ-004-S1-C2-SC1', 'Joint d\'étanchéité arbre', 'sous_composant', arbre);
    }
    if (s2) insertChild('EQ-004-S2-C1', 'Moteur électrique', 'composant', s2);
  }

  // Machine supplémentaire sur Ligne L2 (sans département) pour illustrer Ligne → Machine → …
  const eq005Id = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-005');
  if (!eq005Id) {
    try {
      db.prepare(`
        INSERT OR IGNORE INTO equipment (code, name, category_id, ligne_id, serial_number, criticite, status, equipment_type)
        VALUES ('EQ-005', 'Enrobeuse L2', ?, ?, 'ENR-2022-007', 'B', 'operational', 'machine')
      `).run(catDefault, ligneIds['L2'] || null);
    } catch (e) {}
  }
  const eq005 = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-005');
  if (eq005) {
    const s1 = insertChild('EQ-005-S1', 'Bain d\'enrobage', 'section', eq005.id);
    if (s1) {
      insertChild('EQ-005-S1-C1', 'Résistance chauffante', 'composant', s1);
      const c2 = insertChild('EQ-005-S1-C2', 'Thermostat', 'composant', s1);
      if (c2) insertChild('EQ-005-S1-C2-SC1', 'Sonde température', 'sous_composant', c2);
    }
  }

  const suppliers = [
    { code: 'FOUR-001', name: 'Industrial Parts SARL', contact: 'M. Martin', email: 'contact@indparts.fr', phone: '01 23 45 67 89' },
    { code: 'FOUR-002', name: 'Electro Maintenance', contact: 'Mme Dubois', email: 'info@electromaint.fr', phone: '01 98 76 54 32' }
  ];
  for (const s of suppliers) {
    db.prepare('INSERT OR IGNORE INTO suppliers (code, name, contact_person, email, phone) VALUES (?, ?, ?, ?, ?)')
      .run(s.code, s.name, s.contact, s.email, s.phone);
  }

  const spareParts = [
    { code: 'PR-001', name: 'Joint étanchéité PH', minStock: 5, unitPrice: 25.50 },
    { code: 'PR-002', name: 'Courroie transmission 1200mm', minStock: 3, unitPrice: 89.00 },
    { code: 'PR-003', name: 'Roulement 6205', minStock: 10, unitPrice: 15.00 },
    { code: 'PR-004', name: 'Filtre huile 10µ', minStock: 8, unitPrice: 45.00 }
  ];
  for (const p of spareParts) {
    db.prepare('INSERT OR IGNORE INTO spare_parts (code, name, min_stock, unit_price) VALUES (?, ?, ?, ?)')
      .run(p.code, p.name, p.minStock, p.unitPrice);
  }

  const parts = db.prepare('SELECT id FROM spare_parts').all();
  for (const p of parts) {
    db.prepare('INSERT OR IGNORE INTO stock_balance (spare_part_id, quantity) VALUES (?, 20)').run(p.id);
  }

  const equipmentIds = db.prepare('SELECT id FROM equipment LIMIT 2').all();
  if (equipmentIds.length >= 2) {
    const next30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    db.prepare('INSERT OR IGNORE INTO maintenance_plans (equipment_id, name, description, frequency_days, next_due_date, is_active) VALUES (?, ?, ?, 30, ?, 1)')
      .run(equipmentIds[0].id, 'Lubrification mensuelle', 'Graissage des paliers', next30);
    db.prepare('INSERT OR IGNORE INTO maintenance_plans (equipment_id, name, description, frequency_days, next_due_date, is_active) VALUES (?, ?, ?, 90, ?, 1)')
      .run(equipmentIds[1].id, 'Inspection trimestrielle', 'Contrôle général', next30);
  }

  const woTypeId = db.prepare('SELECT id FROM work_order_types WHERE name = ?').get('Correctif')?.id || 1;
  const techId = db.prepare('SELECT id FROM users WHERE email = ?').get('technicien@xmaint.org')?.id || 1;
  const eqId = db.prepare('SELECT id FROM equipment LIMIT 1').get()?.id || 1;

  const workOrders = [
    { number: 'OT-2025-001', title: 'Réparation presse - fuite hydraulique', status: 'completed' },
    { number: 'OT-2025-002', title: 'Remplacement courroie convoyeur', status: 'in_progress' },
    { number: 'OT-2025-003', title: 'Lubrification préventive', status: 'pending' }
  ];

  for (const wo of workOrders) {
    db.prepare('INSERT OR IGNORE INTO work_orders (number, title, equipment_id, type_id, status, assigned_to, priority) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(wo.number, wo.title, eqId, woTypeId, wo.status, techId, 'medium');
  }

  // Projets de maintenance (regroupement OT, budget)
  try {
    const siteIdProj = db.prepare('SELECT id FROM sites WHERE code = ?').get('SITE-01')?.id;
    const site2IdProj = db.prepare('SELECT id FROM sites WHERE code = ?').get('SITE-02')?.id;
    const startProj = new Date().toISOString().split('T')[0];
    const endProj = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const projectsSeed = [
      { name: 'Maintenance annuelle ligne 1', description: 'Regroupement des OT préventifs et correctifs sur la ligne assemblage', budget: 45000, siteId: siteIdProj, status: 'active' },
      { name: 'Projet énergie & fluides', description: 'Maintenance transformateurs et pompes', budget: 28000, siteId: siteIdProj, status: 'active' },
      { name: 'Logistique - Entrepôt', description: 'OT sur convoyeurs et stockage (SITE-02)', budget: 15000, siteId: site2IdProj, status: 'draft' }
    ];
    const insProj = db.prepare(`
      INSERT INTO maintenance_projects (name, description, budget_amount, site_id, start_date, end_date, status)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM maintenance_projects WHERE name = ?)
    `);
    for (const p of projectsSeed) {
      insProj.run(p.name, p.description, p.budget, p.siteId || null, startProj, endProj, p.status, p.name);
    }

    const proj1Id = db.prepare('SELECT id FROM maintenance_projects WHERE name = ?').get('Maintenance annuelle ligne 1')?.id;
    if (proj1Id) {
      db.prepare('UPDATE work_orders SET project_id = ? WHERE number IN (?, ?)').run(proj1Id, 'OT-2025-001', 'OT-2025-002');
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Projets de maintenance:', e.message);
  }

  // Étape 2 : Documents, contrats de maintenance, alertes
  try {
    const userId = db.prepare('SELECT id FROM users LIMIT 1').get()?.id || 1;
    const suppId = db.prepare('SELECT id FROM suppliers LIMIT 1').get()?.id || 1;
    db.prepare(`INSERT OR IGNORE INTO documents (entity_type, entity_id, filename, original_filename, file_path, document_type, description, uploaded_by)
      VALUES ('equipment', ?, 'notice-eq.pdf', 'Notice_P500.pdf', '/docs/notice-eq.pdf', 'manual', 'Notice constructeur', ?)`).run(eqId, userId);
    db.prepare(`INSERT OR IGNORE INTO documents (entity_type, entity_id, filename, original_filename, file_path, document_type, uploaded_by)
      VALUES ('work_order', ?, 'photo-ot.jpg', 'fuite.jpg', '/docs/photo-ot.jpg', 'photo', ?)`).run(db.prepare('SELECT id FROM work_orders LIMIT 1').get()?.id || 1, userId);

    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    db.prepare(`INSERT OR IGNORE INTO maintenance_contracts (contract_number, name, supplier_id, equipment_id, contract_type, start_date, end_date, annual_cost, is_active)
      VALUES ('CT-2025-001', 'Contrat presse P500', ?, ?, 'preventive', ?, ?, 12000, 1)`).run(suppId, eqId, startDate, endDate);
    db.prepare(`INSERT OR IGNORE INTO maintenance_contracts (contract_number, name, supplier_id, contract_type, start_date, end_date, annual_cost, is_active)
      VALUES ('CT-2025-002', 'Contrat pièces détachées', ?, 'spare_parts', ?, ?, 5000, 1)`).run(suppId, startDate, endDate);

    db.prepare(`INSERT OR IGNORE INTO alerts (alert_type, severity, title, message, entity_type, entity_id, is_read)
      VALUES ('maintenance_due', 'warning', 'Maintenance à prévoir', 'Lubrification mensuelle EQ-001 due sous 30j', 'maintenance_plan', 1, 0)`).run();
    db.prepare(`INSERT OR IGNORE INTO alerts (alert_type, severity, title, message, entity_type, is_read)
      VALUES ('stock_low', 'info', 'Stock faible', 'Roulement 6205 sous seuil minimum', 'stock', 0)`).run();
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Documents/contrats/alertes:', e.message);
  }

  // Étape 3 : Compétences (skills, user_skills, equipment_required_skills)
  try {
    const skillsData = [
      { name: 'Mécanique', category: 'mechanical' },
      { name: 'Électricité', category: 'electrical' },
      { name: 'Hydraulique', category: 'hydraulic' },
      { name: 'Pneumatique', category: 'pneumatic' }
    ];
    for (const s of skillsData) {
      db.prepare('INSERT OR IGNORE INTO skills (name, category) VALUES (?, ?)').run(s.name, s.category);
    }
    const skillIds = db.prepare('SELECT id, name FROM skills').all().reduce((acc, r) => { acc[r.name] = r.id; return acc; }, {});
    const techId2 = db.prepare('SELECT id FROM users WHERE email = ?').get('technicien@xmaint.org')?.id;
    if (techId2 && skillIds['Mécanique']) {
      db.prepare('INSERT OR IGNORE INTO user_skills (user_id, skill_id, level) VALUES (?, ?, ?)').run(techId2, skillIds['Mécanique'], 'advanced');
      db.prepare('INSERT OR IGNORE INTO user_skills (user_id, skill_id, level) VALUES (?, ?, ?)').run(techId2, skillIds['Hydraulique'], 'intermediate');
    }
    const eq1 = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-001')?.id;
    if (eq1 && skillIds['Hydraulique']) {
      db.prepare('INSERT OR IGNORE INTO equipment_required_skills (equipment_id, skill_id, required_level) VALUES (?, ?, ?)').run(eq1, skillIds['Hydraulique'], 'intermediate');
      if (skillIds['Mécanique']) db.prepare('INSERT OR IGNORE INTO equipment_required_skills (equipment_id, skill_id, required_level) VALUES (?, ?, ?)').run(eq1, skillIds['Mécanique'], 'basic');
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Compétences:', e.message);
  }

  // Étape 4 : Outils et affectations (tools, tool_assignments)
  try {
    const calDue = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    db.prepare(`INSERT OR IGNORE INTO tools (code, name, tool_type, status, calibration_due_date) VALUES ('OUT-001', 'Clé dynamométrique 50Nm', 'hand_tool', 'available', ?)`).run(calDue);
    db.prepare(`INSERT OR IGNORE INTO tools (code, name, tool_type, status) VALUES ('OUT-002', 'Multimètre Fluke', 'measuring', 'in_use')`).run();
    db.prepare(`INSERT OR IGNORE INTO tools (code, name, tool_type, status) VALUES ('OUT-003', 'Casque anti-bruit', 'safety', 'available')`).run();
    const tool1 = db.prepare('SELECT id FROM tools WHERE code = ?').get('OUT-001')?.id;
    const wo1 = db.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-002')?.id;
    const techId3 = db.prepare('SELECT id FROM users WHERE email = ?').get('technicien@xmaint.org')?.id;
    if (tool1 && wo1 && techId3) {
      db.prepare('INSERT OR IGNORE INTO tool_assignments (tool_id, work_order_id, assigned_to) VALUES (?, ?, ?)').run(tool1, wo1, techId3);
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Outils:', e.message);
  }

  // Étape 5 : Checklists de maintenance
  try {
    const planId = db.prepare('SELECT id FROM maintenance_plans LIMIT 1').get()?.id;
    if (planId) {
      db.prepare('INSERT OR IGNORE INTO maintenance_checklists (maintenance_plan_id, name, description) VALUES (?, ?, ?)')
        .run(planId, 'Checklist lubrification', 'Points de graissage à contrôler');
      const chkId = db.prepare('SELECT id FROM maintenance_checklists LIMIT 1').get()?.id;
      if (chkId) {
        db.prepare('INSERT OR IGNORE INTO checklist_items (checklist_id, item_text, item_type, order_index) VALUES (?, ?, ?, ?)').run(chkId, 'Niveau huile vérifié', 'check', 1);
        db.prepare('INSERT OR IGNORE INTO checklist_items (checklist_id, item_text, item_type, expected_value, unit, order_index) VALUES (?, ?, ?, ?, ?, ?)').run(chkId, 'Pression circuit (bar)', 'measurement', '150', 'bar', 2);
        const woId = db.prepare('SELECT id FROM work_orders LIMIT 1').get()?.id;
        const techId4 = db.prepare('SELECT id FROM users LIMIT 1').get()?.id;
        if (woId) {
          db.prepare('INSERT OR IGNORE INTO checklist_executions (checklist_id, work_order_id, executed_by) VALUES (?, ?, ?)').run(chkId, woId, techId4);
          const execId = db.prepare('SELECT id FROM checklist_executions LIMIT 1').get()?.id;
          const itemId = db.prepare('SELECT id FROM checklist_items LIMIT 1').get()?.id;
          if (execId && itemId) {
            db.prepare('INSERT OR IGNORE INTO checklist_item_results (execution_id, item_id, value, is_ok) VALUES (?, ?, ?, ?)').run(execId, itemId, null, 1);
          }
        }
      }
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Checklists:', e.message);
  }

  // Étape 6 : Garanties, arrêts planifiés (warranties, planned_shutdowns, shutdown_work_orders)
  try {
    const suppId2 = db.prepare('SELECT id FROM suppliers LIMIT 1').get()?.id;
    const eqId2 = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-001')?.id;
    const wStart = new Date().toISOString().split('T')[0];
    const wEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    if (eqId2 && suppId2) {
      db.prepare(`INSERT OR IGNORE INTO warranties (warranty_number, equipment_id, supplier_id, warranty_type, start_date, end_date, coverage_description, is_active)
        VALUES ('GAR-001', ?, ?, 'parts', ?, ?, 'Pièces défectueuses', 1)`).run(eqId2, suppId2, wStart, wEnd);
    }
    const siteIdSh = db.prepare('SELECT id FROM sites LIMIT 1').get()?.id;
    const userIdSh = db.prepare('SELECT id FROM users LIMIT 1').get()?.id;
    const shStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const shEnd = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    if (siteIdSh && userIdSh) {
      db.prepare(`INSERT OR IGNORE INTO planned_shutdowns (shutdown_number, name, site_id, start_date, end_date, duration_hours, status, created_by)
        VALUES ('ARR-2025-001', 'Maintenance annuelle ligne 1', ?, ?, ?, ?, 'planned', ?)`).run(siteIdSh, shStart, shEnd, 24, userIdSh);
      const shutId = db.prepare('SELECT id FROM planned_shutdowns LIMIT 1').get()?.id;
      const woIdSh = db.prepare('SELECT id FROM work_orders LIMIT 1').get()?.id;
      if (shutId && woIdSh) {
        db.prepare('INSERT OR IGNORE INTO shutdown_work_orders (shutdown_id, work_order_id) VALUES (?, ?)').run(shutId, woIdSh);
      }
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Garanties/arrêts:', e.message);
  }

  // Étape 7 : Budgets et lignes (budgets, budget_items)
  try {
    const bStart = new Date().toISOString().split('T')[0];
    const bEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const userIdB = db.prepare('SELECT id FROM users LIMIT 1').get()?.id;
    db.prepare(`INSERT OR IGNORE INTO budgets (budget_number, name, description, project_type, start_date, end_date, allocated_budget, status, created_by)
      VALUES ('BUD-2025-001', 'Budget maintenance annuelle', 'Maintenance préventive et corrective', 'maintenance', ?, ?, 85000, 'approved', ?)`).run(bStart, bEnd, userIdB);
    const budId = db.prepare('SELECT id FROM budgets LIMIT 1').get()?.id;
    if (budId) {
      db.prepare('INSERT OR IGNORE INTO budget_items (budget_id, item_type, description, planned_amount, category) VALUES (?, ?, ?, ?, ?)').run(budId, 'contract', 'Contrats maintenance', 50000, 'external');
      db.prepare('INSERT OR IGNORE INTO budget_items (budget_id, item_type, description, planned_amount, category) VALUES (?, ?, ?, ?, ?)').run(budId, 'work_order', 'Main d\'œuvre interne', 25000, 'labor');
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Budgets:', e.message);
  }

  // Étape 8 : Commandes fournisseurs, interventions, pièces-équipement, mouvements de stock
  try {
    const suppId3 = db.prepare('SELECT id FROM suppliers LIMIT 1').get()?.id;
    const userId8 = db.prepare('SELECT id FROM users LIMIT 1').get()?.id;
    const partIds = db.prepare('SELECT id FROM spare_parts').all();
    if (suppId3 && userId8) {
      db.prepare(`INSERT OR IGNORE INTO supplier_orders (order_number, supplier_id, status, order_date, expected_date, total_amount, created_by)
        VALUES ('CMD-2025-001', ?, 'sent', ?, ?, 1250.50, ?)`).run(
        suppId3,
        new Date().toISOString().split('T')[0],
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        userId8
      );
      const orderId = db.prepare('SELECT id FROM supplier_orders LIMIT 1').get()?.id;
      if (orderId && partIds.length >= 2) {
        db.prepare('INSERT OR IGNORE INTO supplier_order_lines (order_id, spare_part_id, quantity, unit_price) VALUES (?, ?, ?, ?)').run(orderId, partIds[0].id, 10, 25.50);
        db.prepare('INSERT OR IGNORE INTO supplier_order_lines (order_id, spare_part_id, quantity, unit_price) VALUES (?, ?, ?, ?)').run(orderId, partIds[1].id, 2, 89);
      }
    }
    const woIdI = db.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-001')?.id;
    if (woIdI && techId && partIds?.length) {
      db.prepare('INSERT OR IGNORE INTO interventions (work_order_id, description, hours_spent, spare_part_id, quantity_used, technician_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(woIdI, 'Remplacement joint + purge', 2.5, partIds[0].id, 1, techId);
    }
    const eqIdEsp = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-001')?.id;
    if (eqIdEsp && partIds?.length >= 2) {
      db.prepare('INSERT OR IGNORE INTO equipment_spare_parts (equipment_id, spare_part_id, quantity) VALUES (?, ?, ?)').run(eqIdEsp, partIds[0].id, 2);
      db.prepare('INSERT OR IGNORE INTO equipment_spare_parts (equipment_id, spare_part_id, quantity) VALUES (?, ?, ?)').run(eqIdEsp, partIds[1].id, 1);
    }
    if (partIds?.length && userId8) {
      db.prepare('INSERT OR IGNORE INTO stock_movements (spare_part_id, quantity, movement_type, reference, user_id, notes) VALUES (?, ?, ?, ?, ?, ?)')
        .run(partIds[0].id, 50, 'in', 'RECEP-001', userId8, 'Réception commande');
      db.prepare('INSERT OR IGNORE INTO stock_movements (spare_part_id, quantity, movement_type, work_order_id, user_id, notes) VALUES (?, ?, ?, ?, ?, ?)')
        .run(partIds[0].id, -1, 'out', woIdI || null, userId8, 'Consommation OT-2025-001');
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Commandes/interventions/stock:', e.message);
  }

  // ——— Données de test pour les nouveaux modules (Demandes d'intervention, Compteurs, IoT, SIG) ———
  try {
    const userReq = db.prepare('SELECT id FROM users WHERE email = ?').get('user@xmaint.org')?.id;
    const respId = db.prepare('SELECT id FROM users WHERE email = ?').get('responsable@xmaint.org')?.id;
    const eqReq1 = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-001')?.id;
    const eqReq2 = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-004')?.id;
    const woCreated = db.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-002')?.id;

    if (userReq && eqReq1) {
      db.prepare(`
        INSERT OR IGNORE INTO intervention_requests (title, description, equipment_id, requested_by, priority, status)
        VALUES ('Bruit anormal sur presse P500', 'Bruit métallique côté bloc hydraulique', ?, ?, 'high', 'pending')
      `).run(eqReq1, userReq);
      db.prepare(`
        INSERT OR IGNORE INTO intervention_requests (title, description, equipment_id, requested_by, priority, status)
        VALUES ('Fuite huile pompe centrifuge', 'Gouttes sous la pompe PC-200', ?, ?, 'medium', 'pending')
      `).run(eqReq2, userReq);
    }
    const eqConv = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-002')?.id;
    if (userReq && respId && (eqConv || eqId) && woCreated) {
      db.prepare(`
        INSERT OR IGNORE INTO intervention_requests (title, description, equipment_id, requested_by, priority, status, work_order_id, validated_by, validated_at)
        VALUES ('Vibration convoyeur L1', 'Vibration au démarrage', ?, ?, 'critical', 'validated', ?, ?, datetime('now'))
      `).run(eqConv || eqId, userReq, woCreated, respId);
      db.prepare(`
        INSERT OR IGNORE INTO intervention_requests (title, description, equipment_id, requested_by, priority, status, validated_by, validated_at, rejection_reason)
        VALUES ('Demande de nettoyage encoffrement', 'Nettoyage demandé sans urgence', ?, ?, 'low', 'rejected', ?, datetime('now'), 'Reporté au prochain arrêt planifié')
      `).run(eqReq1, userReq, respId);
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Demandes d\'intervention:', e.message);
  }

  try {
    const eqC1 = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-001')?.id;
    const eqC2 = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-004')?.id;
    if (eqC1) {
      db.prepare('INSERT OR REPLACE INTO equipment_counters (equipment_id, counter_type, value, unit) VALUES (?, ?, ?, ?)').run(eqC1, 'hours', 4850, 'h');
      db.prepare('INSERT OR REPLACE INTO equipment_counters (equipment_id, counter_type, value, unit) VALUES (?, ?, ?, ?)').run(eqC1, 'cycles', 125000, 'cycles');
    }
    if (eqC2) {
      db.prepare('INSERT OR REPLACE INTO equipment_counters (equipment_id, counter_type, value, unit) VALUES (?, ?, ?, ?)').run(eqC2, 'hours', 3200, 'h');
      db.prepare('INSERT OR REPLACE INTO equipment_counters (equipment_id, counter_type, value, unit) VALUES (?, ?, ?, ?)').run(eqC2, 'cycles', 8900, 'cycles');
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Compteurs équipement:', e.message);
  }

  try {
    const eqP1 = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-001')?.id;
    const eqP2 = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-004')?.id;
    if (eqP1) {
      db.prepare(`
        INSERT OR IGNORE INTO maintenance_plans (equipment_id, name, description, frequency_days, next_due_date, is_active, trigger_type, counter_type, threshold_value)
        VALUES (?, 'Révision 5000 h', 'Révision complète presse (heures de marche)', 365, NULL, 1, 'counter', 'hours', 5000)
      `).run(eqP1);
      db.prepare(`
        INSERT OR IGNORE INTO maintenance_plans (equipment_id, name, description, frequency_days, next_due_date, is_active, trigger_type, counter_type, threshold_value)
        VALUES (?, 'Contrôle 150 000 cycles', 'Contrôle paliers et courroies (cycles)', 365, NULL, 1, 'counter', 'cycles', 150000)
      `).run(eqP1);
    }
    if (eqP2) {
      db.prepare(`
        INSERT OR IGNORE INTO maintenance_plans (equipment_id, name, description, frequency_days, next_due_date, is_active, trigger_type, counter_type, threshold_value)
        VALUES (?, 'Révision 10 000 h pompe', 'Révision pompe centrifuge (heures)', 365, NULL, 1, 'counter', 'hours', 10000)
      `).run(eqP2);
    }
  } catch (e) {
    if (!e.message?.includes('no such table') && !e.message?.includes('no such column')) console.warn('Plans conditionnels:', e.message);
  }

  try {
    const eqT1 = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-001')?.id;
    const eqT2 = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-004')?.id;
    if (eqT1) {
      db.prepare(`
        INSERT OR IGNORE INTO equipment_thresholds (equipment_id, metric, threshold_value, operator, create_wo_on_breach)
        VALUES (?, 'hours', 5000, '>=', 0)
      `).run(eqT1);
      db.prepare(`
        INSERT OR IGNORE INTO equipment_thresholds (equipment_id, metric, threshold_value, operator, create_wo_on_breach)
        VALUES (?, 'vibrations', 7.5, '>=', 0)
      `).run(eqT1);
    }
    if (eqT2) {
      db.prepare(`
        INSERT OR IGNORE INTO equipment_thresholds (equipment_id, metric, threshold_value, operator, create_wo_on_breach)
        VALUES (?, 'hours', 10000, '>=', 0)
      `).run(eqT2);
      db.prepare(`
        INSERT OR IGNORE INTO equipment_thresholds (equipment_id, metric, threshold_value, operator, create_wo_on_breach)
        VALUES (?, 'temperature', 85, '>=', 0)
      `).run(eqT2);
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Seuils IoT:', e.message);
  }

  try {
    db.prepare("UPDATE sites SET latitude = 48.8566, longitude = 2.3522 WHERE code = 'SITE-01'").run();
    db.prepare("UPDATE sites SET latitude = 48.8606, longitude = 2.3376 WHERE code = 'SITE-02'").run();
  } catch (e) {
    if (!e.message?.includes('no such column')) console.warn('Géoloc sites:', e.message);
  }

  // ——— Étape 9 : Extensions GMAO (migration 039) ———
  try {
    db.prepare("INSERT OR IGNORE INTO part_families (code, name, description) VALUES ('FAM-01', 'Joints et étanchéité', 'Joints, garnitures')").run();
    db.prepare("INSERT OR IGNORE INTO part_families (code, name, description) VALUES ('FAM-02', 'Transmission', 'Courroies, roulements')").run();
    db.prepare("INSERT OR IGNORE INTO part_families (code, name, description) VALUES ('FAM-03', 'Filtres', 'Filtres hydrauliques et air')").run();
    db.prepare("INSERT OR IGNORE INTO brands (code, name, description) VALUES ('BR-01', 'HydraTech', 'Constructeur presses')").run();
    db.prepare("INSERT OR IGNORE INTO brands (code, name, description) VALUES ('BR-02', 'ConveyorPro', 'Convoyeurs industriels')").run();
    db.prepare("INSERT OR IGNORE INTO brands (code, name, description) VALUES ('BR-03', 'PumpMaster', 'Pompes et compresseurs')").run();
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('part_families/brands:', e.message);
  }
  try {
    const siteIdB = db.prepare('SELECT id FROM sites WHERE code = ?').get('SITE-01')?.id;
    const projIdB = db.prepare('SELECT id FROM maintenance_projects LIMIT 1').get()?.id;
    const yearB = new Date().getFullYear();
    db.prepare('INSERT OR IGNORE INTO maintenance_budgets (name, site_id, project_id, year, amount, currency, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('Budget maintenance ' + yearB, siteIdB || null, projIdB || null, yearB, 85000, 'EUR', 'Budget annuel préventif et correctif');
    db.prepare('INSERT OR IGNORE INTO maintenance_budgets (name, site_id, year, amount, currency) VALUES (?, ?, ?, ?, ?)')
      .run('Budget pièces détachées ' + yearB, siteIdB || null, yearB, 25000, 'EUR');
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('maintenance_budgets:', e.message);
  }
  try {
    db.prepare("INSERT OR IGNORE INTO external_contractors (code, name, contact_person, email, phone) VALUES ('ST-01', 'Sous-traitance Mécanique SA', 'M. Dupont', 'contact@st-meca.fr', '01 23 45 67 00')").run();
    db.prepare("INSERT OR IGNORE INTO external_contractors (code, name, contact_person, email) VALUES ('ST-02', 'Électricité Industrielle', 'Mme Martin', 'info@elec-indus.fr')").run();
    const contractorId = db.prepare('SELECT id FROM external_contractors WHERE code = ?').get('ST-01')?.id;
    const woIdSub = db.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-001')?.id;
    const userIdSub = db.prepare('SELECT id FROM users LIMIT 1').get()?.id;
    if (contractorId && userIdSub) {
      const y = new Date().getFullYear();
      db.prepare('INSERT OR IGNORE INTO subcontract_orders (number, contractor_id, work_order_id, description, status, order_date, expected_date, amount, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run('ST-' + y + '-0001', contractorId, woIdSub || null, 'Usinage pièce spéciale presse', 'sent', new Date().toISOString().slice(0, 10), new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), 1500, userIdSub);
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('external_contractors/subcontract_orders:', e.message);
  }
  try {
    db.prepare("INSERT OR IGNORE INTO training_catalog (code, name, description, duration_hours, validity_months, is_mandatory) VALUES ('FORM-01', 'SST Niveau 1', 'Sauvetage secourisme du travail', 7, 24, 1)").run();
    db.prepare("INSERT OR IGNORE INTO training_catalog (code, name, description, duration_hours, validity_months) VALUES ('FORM-02', 'Hydraulique industrielle', 'Bases hydraulique et dépannage', 16, 36)").run();
    db.prepare("INSERT OR IGNORE INTO training_catalog (code, name, description, duration_hours) VALUES ('FORM-03', 'Électricité sécurité', 'Risques électriques et consignation', 8, null)").run();
    db.prepare("INSERT OR IGNORE INTO training_catalog (code, name, description, duration_hours, validity_months) VALUES ('FORM-04', 'Pneumatique', 'Circuits et dépannage pneumatique', 12, 60)").run();
    db.prepare("INSERT OR IGNORE INTO training_catalog (code, name, description, duration_hours) VALUES ('FORM-05', 'Habilitation électrique BR', 'Niveau basse tension', 14, 36)").run();
    const cat1 = db.prepare('SELECT id FROM training_catalog WHERE code = ?').get('FORM-01')?.id;
    const cat2 = db.prepare('SELECT id FROM training_catalog WHERE code = ?').get('FORM-02')?.id;
    const cat3 = db.prepare('SELECT id FROM training_catalog WHERE code = ?').get('FORM-03')?.id;
    const cat4 = db.prepare('SELECT id FROM training_catalog WHERE code = ?').get('FORM-04')?.id;
    const techIdTrain = db.prepare('SELECT id FROM users WHERE email = ?').get('technicien@xmaint.org')?.id;
    const tech2Train = db.prepare('SELECT id FROM users WHERE email = ?').get('technicien2@xmaint.org')?.id;
    const tech3Train = db.prepare('SELECT id FROM users WHERE email = ?').get('technicien3@xmaint.org')?.id;
    const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const completedDate = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    if (cat1 && techIdTrain) {
      db.prepare('INSERT OR IGNORE INTO training_plans (technician_id, training_catalog_id, planned_date, completed_date, status, notes) VALUES (?, ?, ?, NULL, ?, NULL)')
        .run(techIdTrain, cat1, nextMonth, null, 'planned', null);
    }
    if (cat2 && tech2Train) {
      db.prepare('INSERT OR IGNORE INTO training_plans (technician_id, training_catalog_id, planned_date, completed_date, status, notes) VALUES (?, ?, ?, ?, ?, ?)')
        .run(tech2Train, cat2, nextMonth, completedDate, 'completed', 'Validée');
    }
    if (cat3 && tech3Train) {
      db.prepare('INSERT OR IGNORE INTO training_plans (technician_id, training_catalog_id, planned_date, completed_date, status, notes) VALUES (?, ?, ?, NULL, ?, NULL)')
        .run(tech3Train, cat3, new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), null, 'planned', null);
    }
    if (cat4 && techIdTrain) {
      db.prepare('INSERT OR IGNORE INTO training_plans (technician_id, training_catalog_id, planned_date, completed_date, status, notes) VALUES (?, ?, ?, ?, ?, ?)')
        .run(techIdTrain, cat4, null, completedDate, 'completed', 'Formation interne');
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('training_catalog/training_plans:', e.message);
  }
  try {
    const woIdSat = db.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-001')?.id;
    if (woIdSat) {
      db.prepare('INSERT OR IGNORE INTO satisfaction_surveys (work_order_id, rating, comment) VALUES (?, ?, ?)')
        .run(woIdSat, 4, 'Intervention rapide et efficace.');
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('satisfaction_surveys:', e.message);
  }
  try {
    const woIdRc = db.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-001')?.id;
    const eqIdRc = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-001')?.id;
    const userIdRc = db.prepare('SELECT id FROM users LIMIT 1').get()?.id;
    if (woIdRc && userIdRc) {
      db.prepare('INSERT OR IGNORE INTO equipment_root_causes (work_order_id, equipment_id, root_cause_code, root_cause_description, analysis_method, created_by) VALUES (?, ?, ?, ?, ?, ?)')
        .run(woIdRc, eqIdRc || null, 'USURE', 'Usure joint après 5000 h', '5M', userIdRc);
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('equipment_root_causes:', e.message);
  }
  try {
    const typeIdTmpl = db.prepare('SELECT id FROM work_order_types WHERE name = ?').get('Correctif')?.id;
    db.prepare('INSERT OR IGNORE INTO work_order_templates (name, description, type_id, default_priority, estimated_hours) VALUES (?, ?, ?, ?, ?)')
      .run('Correctif standard', 'OT correctif générique', typeIdTmpl || null, 'medium', 2);
    db.prepare('INSERT OR IGNORE INTO work_order_templates (name, description, type_id, default_priority, estimated_hours) VALUES (?, ?, ?, ?, ?)')
      .run('Inspection mensuelle', 'Tour de contrôle équipement', db.prepare('SELECT id FROM work_order_types WHERE name = ?').get('Inspection')?.id || null, 'low', 0.5);
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('work_order_templates:', e.message);
  }
  try {
    const siteIdLoc = db.prepare('SELECT id FROM sites WHERE code = ?').get('SITE-01')?.id;
    db.prepare('INSERT OR IGNORE INTO stock_locations (code, name, description, site_id) VALUES (?, ?, ?, ?)')
      .run('EMP-A1', 'Étagère A - Zone atelier', 'Zone pièces courantes', siteIdLoc || null);
    db.prepare('INSERT OR IGNORE INTO stock_locations (code, name, description) VALUES (?, ?, ?)')
      .run('EMP-B1', 'Réserve centrale', 'Stock sécurité');
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('stock_locations:', e.message);
  }
  try {
    const partIdRes = db.prepare('SELECT id FROM spare_parts LIMIT 1').get()?.id;
    const woIdRes = db.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-002')?.id;
    const userIdRes = db.prepare('SELECT id FROM users LIMIT 1').get()?.id;
    if (partIdRes && woIdRes && userIdRes) {
      db.prepare('INSERT OR IGNORE INTO stock_reservations (spare_part_id, work_order_id, quantity, status, reserved_by) VALUES (?, ?, ?, ?, ?)')
        .run(partIdRes, woIdRes, 2, 'reserved', userIdRes);
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('stock_reservations:', e.message);
  }
  try {
    db.prepare("INSERT OR IGNORE INTO email_templates (code, name, subject_template, body_template, description) VALUES ('wo_assigned', 'OT affecté', 'OT {{wo_number}} vous a été affecté', 'Bonjour,\n\nL''ordre de travail {{wo_number}} vous a été affecté.\n\nCordialement', 'Notification affectation OT')").run();
    db.prepare("INSERT OR IGNORE INTO email_templates (code, name, subject_template, body_template) VALUES ('wo_completed', 'OT clôturé', 'OT {{wo_number}} clôturé', 'L''ordre de travail {{wo_number}} a été clôturé.')").run();
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('email_templates:', e.message);
  }

  // ——— Données de test développement : couvrir toutes les tables ———
  const techIdDev = db.prepare('SELECT id FROM users WHERE email = ?').get('technicien@xmaint.org')?.id || 1;
  const userIdDev = db.prepare('SELECT id FROM users LIMIT 1').get()?.id || 1;
  const respIdDev = db.prepare('SELECT id FROM users WHERE email = ?').get('responsable@xmaint.org')?.id || 1;

  try {
    db.prepare("INSERT OR IGNORE INTO part_categories (code, name, description) VALUES ('CAT-PIECES', 'Pièces détachées', 'Consommables et pièces de rechange')").run();
    db.prepare("INSERT OR IGNORE INTO part_categories (code, name, description) VALUES ('CAT-LUB', 'Lubrifiants et fluides', 'Huiles, graisses')").run();
    const partCatId = db.prepare('SELECT id FROM part_categories WHERE code = ?').get('CAT-PIECES')?.id;
    const famId = db.prepare('SELECT id FROM part_families WHERE code = ?').get('FAM-01')?.id;
    if (famId && partCatId) {
      try { db.prepare('UPDATE part_families SET category_id = ? WHERE id = ?').run(partCatId, famId); } catch (_) {}
    }
    const fam2 = db.prepare('SELECT id FROM part_families WHERE code = ?').get('FAM-02')?.id;
    if (fam2 && partCatId) {
      try { db.prepare('UPDATE part_families SET category_id = ? WHERE id = ?').run(partCatId, fam2); } catch (_) {}
    }
    if (famId) {
      db.prepare("INSERT OR IGNORE INTO part_sub_families (part_family_id, position, code, name) VALUES (?, 1, 'SF-JOINT', 'Joints toriques')").run(famId);
      db.prepare("INSERT OR IGNORE INTO part_sub_families (part_family_id, position, code, name) VALUES (?, 2, 'SF-GARN', 'Garnitures mécaniques')").run(famId);
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('part_categories/sub_families:', e.message);
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const tech2Id = db.prepare('SELECT id FROM users WHERE email = ?').get('technicien2@xmaint.org')?.id;
    const tech3Id = db.prepare('SELECT id FROM users WHERE email = ?').get('technicien3@xmaint.org')?.id;
    // Pointage : Pierre (aujourd'hui + hier)
    db.prepare("INSERT OR IGNORE INTO time_entries (technician_id, occurred_at, type, source) VALUES (?, ?, 'in', 'manual')").run(techIdDev, today + ' 08:00:00');
    db.prepare("INSERT OR IGNORE INTO time_entries (technician_id, occurred_at, type, source) VALUES (?, ?, 'out', 'manual')").run(techIdDev, today + ' 12:00:00');
    db.prepare("INSERT OR IGNORE INTO time_entries (technician_id, occurred_at, type, source) VALUES (?, ?, 'in', 'manual')").run(techIdDev, today + ' 13:30:00');
    db.prepare("INSERT OR IGNORE INTO time_entries (technician_id, occurred_at, type, source) VALUES (?, ?, 'out', 'pointeuse')").run(techIdDev, now);
    db.prepare("INSERT OR IGNORE INTO time_entries (technician_id, occurred_at, type, source) VALUES (?, ?, 'in', 'manual')").run(techIdDev, yesterday + ' 08:15:00');
    db.prepare("INSERT OR IGNORE INTO time_entries (technician_id, occurred_at, type, source) VALUES (?, ?, 'out', 'manual')").run(techIdDev, yesterday + ' 17:30:00');
    // Sophie : pointage aujourd'hui
    if (tech2Id) {
      db.prepare("INSERT OR IGNORE INTO time_entries (technician_id, occurred_at, type, source) VALUES (?, ?, 'in', 'manual')").run(tech2Id, today + ' 07:45:00');
      db.prepare("INSERT OR IGNORE INTO time_entries (technician_id, occurred_at, type, source) VALUES (?, ?, 'out', 'manual')").run(tech2Id, today + ' 12:00:00');
      db.prepare("INSERT OR IGNORE INTO time_entries (technician_id, occurred_at, type, source) VALUES (?, ?, 'in', 'manual')").run(tech2Id, today + ' 13:00:00');
      db.prepare("INSERT OR IGNORE INTO time_entries (technician_id, occurred_at, type, source) VALUES (?, ?, 'out', 'pointeuse')").run(tech2Id, today + ' 17:00:00');
    }
    // Lucas : pointage aujourd'hui
    if (tech3Id) {
      db.prepare("INSERT OR IGNORE INTO time_entries (technician_id, occurred_at, type, source) VALUES (?, ?, 'in', 'manual')").run(tech3Id, today + ' 08:30:00');
      db.prepare("INSERT OR IGNORE INTO time_entries (technician_id, occurred_at, type, source) VALUES (?, ?, 'out', 'manual')").run(tech3Id, today + ' 17:45:00');
    }
    // Présence : congés, formation, maladie
    db.prepare("INSERT OR IGNORE INTO attendance_overrides (technician_id, date, status, comment) VALUES (?, ?, 'leave', 'Congés annuels')").run(techIdDev, yesterday);
    db.prepare("INSERT OR IGNORE INTO attendance_overrides (technician_id, date, status, comment) VALUES (?, ?, 'training', 'Formation SST')").run(techIdDev, new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
    if (tech2Id) db.prepare("INSERT OR IGNORE INTO attendance_overrides (technician_id, date, status, comment) VALUES (?, ?, 'sick', 'Arrêt maladie')").run(tech2Id, yesterday);
    if (tech3Id) db.prepare("INSERT OR IGNORE INTO attendance_overrides (technician_id, date, status, comment) VALUES (?, ?, 'training', 'Hydraulique industrielle')").run(tech3Id, new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('time_entries/attendance_overrides:', e.message);
  }

  try {
    const nextRun = new Date(Date.now() + 3600000).toISOString().slice(0, 19).replace('T', ' ');
    db.prepare("INSERT OR IGNORE INTO scheduled_reports (report_type, frequency, recipient_emails, next_run_at, is_active) VALUES ('mtbf_mttr', 'weekly', 'responsable@xmaint.org', ?, 1)").run(nextRun);
    db.prepare("INSERT OR IGNORE INTO scheduled_reports (report_type, frequency, recipient_emails, next_run_at, is_active) VALUES ('work_orders', 'daily', 'admin@xmaint.org', ?, 1)").run(nextRun);
    db.prepare('INSERT OR IGNORE INTO technician_badges (technician_id, badge_code) VALUES (?, ?)').run(techIdDev, 'BADGE-TECH-001');
    if (respIdDev) db.prepare('INSERT OR IGNORE INTO technician_badges (technician_id, badge_code) VALUES (?, ?)').run(respIdDev, 'BADGE-RESP-001');
    const tech2Id = db.prepare('SELECT id FROM users WHERE email = ?').get('technicien2@xmaint.org')?.id;
    const tech3Id = db.prepare('SELECT id FROM users WHERE email = ?').get('technicien3@xmaint.org')?.id;
    if (tech2Id) db.prepare('INSERT OR IGNORE INTO technician_badges (technician_id, badge_code) VALUES (?, ?)').run(tech2Id, 'BADGE-TECH-002');
    if (tech3Id) db.prepare('INSERT OR IGNORE INTO technician_badges (technician_id, badge_code) VALUES (?, ?)').run(tech3Id, 'BADGE-TECH-003');
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('scheduled_reports/technician_badges:', e.message);
  }

  try {
    const woIdCons = db.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-001')?.id;
    const partId1 = db.prepare('SELECT id FROM spare_parts LIMIT 1').get()?.id;
    const partId2 = db.prepare('SELECT id FROM spare_parts LIMIT 1 OFFSET 1').get()?.id;
    if (woIdCons && partId1) {
      db.prepare('INSERT OR IGNORE INTO work_order_consumed_parts (work_order_id, spare_part_id, quantity, unit_cost_at_use) VALUES (?, ?, ?, ?)').run(woIdCons, partId1, 1, 25.50);
      if (partId2) db.prepare('INSERT OR IGNORE INTO work_order_consumed_parts (work_order_id, spare_part_id, quantity, unit_cost_at_use) VALUES (?, ?, ?, ?)').run(woIdCons, partId2, 0.5, 89);
    }
    const wo2 = db.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-002')?.id;
    if (wo2 && partId1) db.prepare('INSERT OR IGNORE INTO work_order_consumed_parts (work_order_id, spare_part_id, quantity, unit_cost_at_use) VALUES (?, ?, ?, ?)').run(wo2, partId1, 2, 25.50);
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('work_order_consumed_parts:', e.message);
  }

  // ——— Coût période : OT clôturés avec actual_end/completed_at dans les 30 derniers jours ———
  try {
    const woTypeId = db.prepare('SELECT id FROM work_order_types WHERE name = ?').get('Correctif')?.id || 1;
    const eqId = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-001')?.id;
    const techId = db.prepare('SELECT id FROM users WHERE email = ?').get('technicien@xmaint.org')?.id;
    const tech2Id = db.prepare('SELECT id FROM users WHERE email = ?').get('technicien2@xmaint.org')?.id;
    const partId1 = db.prepare('SELECT id FROM spare_parts LIMIT 1').get()?.id;
    const daysAgo10 = new Date(Date.now() - 10 * 86400000);
    const daysAgo5 = new Date(Date.now() - 5 * 86400000);
    const daysAgo2 = new Date(Date.now() - 2 * 86400000);
    const start1 = daysAgo10.toISOString().slice(0, 19).replace('T', ' ');
    const end1 = daysAgo10.toISOString().slice(0, 19).replace('T', ' ').slice(0, 11) + '14:30:00';
    const end1Date = daysAgo10.toISOString().slice(0, 10);
    const start2 = daysAgo5.toISOString().slice(0, 19).replace('T', ' ');
    const end2 = daysAgo5.toISOString().slice(0, 19).replace('T', ' ').slice(0, 11) + '16:00:00';
    const end2Date = daysAgo5.toISOString().slice(0, 10);
    const start3 = daysAgo2.toISOString().slice(0, 19).replace('T', ' ');
    const end3 = daysAgo2.toISOString().slice(0, 19).replace('T', ' ').slice(0, 11) + '11:00:00';
    const end3Date = daysAgo2.toISOString().slice(0, 10);
    // OT-2025-001 : déjà en completed, on met actual_start / actual_end / completed_at pour la période
    db.prepare("UPDATE work_orders SET status = 'completed', actual_start = ?, actual_end = ?, completed_at = ? WHERE number = 'OT-2025-001'").run(start1, end1, end1Date);
    // OT supplémentaires clôturés dans la période (coût main d'œuvre + pièces)
    db.prepare('INSERT OR IGNORE INTO work_orders (number, title, equipment_id, type_id, status, priority, assigned_to, actual_start, actual_end, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('OT-2025-007', 'Dépannage convoyeur L1', eqId, woTypeId, 'completed', 'high', techId, start2, end2, end2Date);
    db.prepare('INSERT OR IGNORE INTO work_orders (number, title, equipment_id, type_id, status, priority, assigned_to, actual_start, actual_end, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('OT-2025-008', 'Contrôle pompe PC-200', db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-004')?.id, woTypeId, 'completed', 'medium', tech2Id || techId, start3, end3, end3Date);
    const wo7 = db.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-007')?.id;
    const wo8 = db.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-008')?.id;
    if (wo7 && techId) {
      db.prepare('INSERT OR IGNORE INTO interventions (work_order_id, description, hours_spent, technician_id) VALUES (?, ?, ?, ?)').run(wo7, 'Réglage tension courroie', 1.5, techId);
      if (partId1) db.prepare('INSERT OR IGNORE INTO work_order_consumed_parts (work_order_id, spare_part_id, quantity, unit_cost_at_use) VALUES (?, ?, ?, ?)').run(wo7, partId1, 1, 35);
    }
    if (wo8 && (tech2Id || techId)) {
      db.prepare('INSERT OR IGNORE INTO interventions (work_order_id, description, hours_spent, technician_id) VALUES (?, ?, ?, ?)').run(wo8, 'Inspection et nettoyage', 0.75, tech2Id || techId);
      if (partId1) db.prepare('INSERT OR IGNORE INTO work_order_consumed_parts (work_order_id, spare_part_id, quantity, unit_cost_at_use) VALUES (?, ?, ?, ?)').run(wo8, partId1, 0, 0);
    }
    // Sous-traitance sur un OT clôturé (compte dans coût période)
    const contractorId = db.prepare('SELECT id FROM external_contractors LIMIT 1').get()?.id;
    const userId = db.prepare('SELECT id FROM users LIMIT 1').get()?.id;
    if (wo7 && contractorId && userId) {
      db.prepare('INSERT OR IGNORE INTO subcontract_orders (number, contractor_id, work_order_id, description, status, order_date, expected_date, amount, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run('ST-2025-PERIODE', contractorId, wo7, 'Expertise courroie', 'completed', end2Date, end2Date, 800, userId);
    }
    // Objectif budget période (si table existe et pas encore renseigné)
    try {
      db.prepare("INSERT OR IGNORE INTO indicator_targets (key, label, target_value, direction, unit, ref_label, sort_order) VALUES ('budget_period', 'Budget période (coût max)', 50000, 'max', '', 'Budget à ne pas dépasser', 8)").run();
    } catch (_) {}
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Coût période (actual_end, OT clôturés):', e.message);
  }

  try {
    const siteIdStock = db.prepare('SELECT id FROM sites WHERE code = ?').get('SITE-01')?.id;
    const partsAll = db.prepare('SELECT id FROM spare_parts').all();
    if (siteIdStock && partsAll.length) {
      for (const p of partsAll.slice(0, 4)) {
        db.prepare('INSERT OR IGNORE INTO stock_by_site (site_id, spare_part_id, quantity) VALUES (?, ?, ?)').run(siteIdStock, p.id, 15);
      }
    }
    const site2 = db.prepare('SELECT id FROM sites WHERE code = ?').get('SITE-02')?.id;
    if (site2 && partsAll.length) {
      for (const p of partsAll.slice(0, 2)) {
        db.prepare('INSERT OR IGNORE INTO stock_by_site (site_id, spare_part_id, quantity) VALUES (?, ?, ?)').run(site2, p.id, 5);
      }
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('stock_by_site:', e.message);
  }

  try {
    const eq1 = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-001')?.id;
    const eq4 = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-004')?.id;
    const dates = [0, -1, -2, -7].map(d => new Date(Date.now() + d * 86400000).toISOString().slice(0, 19).replace('T', ' '));
    if (eq1) {
      db.prepare('INSERT OR IGNORE INTO equipment_counter_history (equipment_id, counter_type, value, recorded_at, source) VALUES (?, ?, ?, ?, ?)').run(eq1, 'hours', 4800, dates[0], 'manual');
      db.prepare('INSERT OR IGNORE INTO equipment_counter_history (equipment_id, counter_type, value, recorded_at, source) VALUES (?, ?, ?, ?, ?)').run(eq1, 'hours', 4750, dates[1], 'manual');
      db.prepare('INSERT OR IGNORE INTO equipment_counter_history (equipment_id, counter_type, value, recorded_at, source) VALUES (?, ?, ?, ?, ?)').run(eq1, 'cycles', 124000, dates[2], 'manual');
    }
    if (eq4) {
      db.prepare('INSERT OR IGNORE INTO equipment_counter_history (equipment_id, counter_type, value, recorded_at, source) VALUES (?, ?, ?, ?, ?)').run(eq4, 'hours', 3180, dates[0], 'manual');
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('equipment_counter_history:', e.message);
  }

  try {
    const catEqId = db.prepare('SELECT id FROM equipment_categories LIMIT 1').get()?.id;
    const eqIdReq = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-001')?.id;
    const siteIdReq = db.prepare('SELECT id FROM sites WHERE code = ?').get('SITE-01')?.id;
    if (catEqId) db.prepare("INSERT OR IGNORE INTO required_document_types (entity_type, entity_id, document_type_name, is_mandatory) VALUES ('equipment_category', ?, ?, 1)").run(catEqId, 'Notice constructeur');
    if (eqIdReq) db.prepare("INSERT OR IGNORE INTO required_document_types (entity_type, entity_id, document_type_name, is_mandatory) VALUES ('equipment', ?, ?, 1)").run(eqIdReq, 'Schéma électrique');
    if (siteIdReq) db.prepare("INSERT OR IGNORE INTO required_document_types (entity_type, entity_id, document_type_name, is_mandatory) VALUES ('site', ?, ?, 0)").run(siteIdReq, 'Plan d\'évacuation');
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('required_document_types:', e.message);
  }

  try {
    db.prepare("INSERT OR IGNORE INTO failure_codes (code, name, description, category) VALUES ('F-USB', 'Usure', 'Usure normale composant', 'mechanical')").run();
    db.prepare("INSERT OR IGNORE INTO failure_codes (code, name, description, category) VALUES ('F-ELEC', 'Défaillance électrique', 'Problème circuit ou composant', 'electrical')").run();
    db.prepare("INSERT OR IGNORE INTO failure_codes (code, name, description, category) VALUES ('F-FUITE', 'Fuite', 'Fuite fluide ou étanchéité', 'hydraulic')").run();
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('failure_codes:', e.message);
  }

  try {
    // Procédures et modes opératoires de test (colonnes réelles : name, description, steps, safety_notes, equipment_model_id ; + procedure_type, code si migration 057)
    const existingCount = db.prepare('SELECT COUNT(*) as c FROM procedures').get()?.c ?? 0;
    if (existingCount === 0) {
      const modelId = db.prepare('SELECT id FROM equipment_models LIMIT 1').get()?.id || null;
      const procRows = [
        { name: 'Lubrification presse P500', description: 'Étapes de graissage points désignés', steps: '1. Couper énergie\n2. Repérer points de graissage\n3. Graisser selon plan', safetyNotes: 'Gants, pas de surgraissage', type: 'maintenance', code: 'MNT-001' },
        { name: 'Contrôle convoyeur', description: 'Vérification tension courroie et rouleaux', steps: '1. Arrêt machine\n2. Vérifier tension courroie\n3. Contrôler rouleaux', safetyNotes: 'Cadenassage obligatoire', type: 'maintenance', code: 'MNT-002' },
        { name: 'Test de mise en route pompe', description: 'Mode opératoire de test après maintenance ou remplacement', steps: '1. Vérifier niveau fluide\n2. Démarrer à vide 2 min\n3. Mise en charge progressive\n4. Relever pressions et températures', safetyNotes: 'Ne pas dépasser Pmax. Port des EPI.', type: 'test', code: 'TEST-001' },
        { name: 'Test électrique moteur', description: 'Contrôle isolation et courant à vide', steps: '1. Coupure électrique et consignation\n2. Mesure mégohm\n3. Remise sous tension\n4. Mesure courant à vide', safetyNotes: 'Travail sous tension interdit sans habilitation.', type: 'test', code: 'TEST-002' },
        { name: 'Réception après réparation', description: 'Procédure de test de réception après intervention', steps: '1. Contrôle visuel\n2. Essai à vide\n3. Essai en charge\n4. Enregistrement des paramètres', safetyNotes: 'Respecter les consignes constructeur.', type: 'test', code: 'TEST-003' },
        { name: 'Mode opératoire démarrage ligne', description: 'Démarrage séquentiel de la ligne de production', steps: '1. Contrôles pré-démarrage\n2. Démarrage auxiliaires\n3. Démarrage moteurs principaux\n4. Mise en production', safetyNotes: 'Signalisation et zone dégagée.', type: 'operating_mode', code: 'OP-001' }
      ];
      for (const row of procRows) {
        try {
          db.prepare(`
            INSERT INTO procedures (name, description, steps, safety_notes, equipment_model_id, procedure_type, code)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(row.name, row.description, row.steps || null, row.safetyNotes || null, modelId, row.type, row.code);
        } catch (colErr) {
          if (colErr.message && colErr.message.includes('no such column')) {
            db.prepare(`
              INSERT INTO procedures (name, description, steps, safety_notes, equipment_model_id)
              VALUES (?, ?, ?, ?, ?)
            `).run(row.name, row.description, row.steps || null, row.safetyNotes || null, modelId);
          } else throw colErr;
        }
      }
      const procId = db.prepare('SELECT id FROM procedures LIMIT 1').get()?.id;
      const woProc = db.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-003')?.id;
      if (procId && woProc) db.prepare('INSERT OR IGNORE INTO work_order_procedures (work_order_id, procedure_id) VALUES (?, ?)').run(woProc, procId);
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('procedures/work_order_procedures:', e.message);
  }

  try {
    const kpiId = db.prepare('SELECT id FROM kpi_definitions LIMIT 1').get()?.id;
    const siteKpi = db.prepare('SELECT id FROM sites LIMIT 1').get()?.id;
    const yearKpi = new Date().getFullYear();
    if (kpiId && siteKpi) db.prepare('INSERT OR IGNORE INTO kpi_targets (kpi_definition_id, site_id, year, target_value, unit) VALUES (?, ?, ?, ?, ?)').run(kpiId, siteKpi, yearKpi, 85, '%');
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('kpi_targets:', e.message);
  }

  try {
    const catEqModel = db.prepare('SELECT id FROM equipment_categories LIMIT 1').get()?.id;
    db.prepare('INSERT OR IGNORE INTO equipment_models (name, manufacturer, model, description, category_id) VALUES (?, ?, ?, ?, ?)').run('Presse hydraulique P500', 'HydraTech', 'P500', 'Modèle standard 500 t', catEqModel);
    db.prepare('INSERT OR IGNORE INTO equipment_models (name, manufacturer, model, category_id) VALUES (?, ?, ?, ?)').run('Pompe centrifuge 200', 'PumpMaster', 'PC-200', catEqModel);
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('equipment_models:', e.message);
  }

  try {
    const invDate = new Date().toISOString().slice(0, 10);
    const partInv = db.prepare('SELECT id FROM spare_parts LIMIT 1').get()?.id;
    if (userIdDev) {
      db.prepare('INSERT OR IGNORE INTO stock_inventories (reference, inventory_date, responsible_id, status) VALUES (?, ?, ?, ?)').run('INV-' + invDate.replace(/-/g, ''), invDate, userIdDev, 'completed');
      const invId = db.prepare('SELECT id FROM stock_inventories ORDER BY id DESC LIMIT 1').get()?.id;
      if (invId && partInv) db.prepare('INSERT OR IGNORE INTO stock_inventory_lines (inventory_id, spare_part_id, quantity_system, quantity_counted, variance) VALUES (?, ?, ?, ?, ?)').run(invId, partInv, 20, 19, -1);
    }
    if (partInv && userIdDev) db.prepare('INSERT OR IGNORE INTO reorder_requests (spare_part_id, quantity_requested, status, requested_by) VALUES (?, ?, ?, ?)').run(partInv, 50, 'pending', userIdDev);
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('stock_inventories/reorder_requests:', e.message);
  }

  try {
    db.prepare('INSERT OR IGNORE INTO notification_preferences (user_id, channel, event_type, enabled) VALUES (?, ?, ?, 1)').run(userIdDev, 'email', 'work_order_assigned');
    db.prepare('INSERT OR IGNORE INTO notification_preferences (user_id, channel, event_type, enabled) VALUES (?, ?, ?, 1)').run(techIdDev, 'email', 'work_order_assigned');
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('notification_preferences:', e.message);
  }

  try {
    const woAudit = db.prepare('SELECT id FROM work_orders LIMIT 1').get()?.id;
    db.prepare('INSERT OR IGNORE INTO audit_log (entity_type, entity_id, action, user_id, summary) VALUES (?, ?, ?, ?, ?)')
      .run('work_order', String(woAudit || 1), 'updated', userIdDev, 'Changement statut en cours');
    db.prepare('INSERT OR IGNORE INTO audit_log (entity_type, entity_id, action, user_id, summary) VALUES (?, ?, ?, ?, ?)')
      .run('equipment', String(db.prepare('SELECT id FROM equipment LIMIT 1').get()?.id || 1), 'created', userIdDev, 'Création équipement test');
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('audit_log:', e.message);
  }

  try {
    const woPhase = db.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-001')?.id;
    if (woPhase) {
      db.prepare('INSERT OR IGNORE INTO work_order_phase_times (work_order_id, phase_name, hours_spent) VALUES (?, ?, ?)').run(woPhase, 'diagnostic', 0.5);
      db.prepare('INSERT OR IGNORE INTO work_order_phase_times (work_order_id, phase_name, hours_spent) VALUES (?, ?, ?)').run(woPhase, 'repair', 1.5);
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('work_order_phase_times:', e.message);
  }

  try {
    const woExtra = db.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-001')?.id;
    if (woExtra) {
      db.prepare('INSERT OR IGNORE INTO work_order_extra_fees (work_order_id, description, amount) VALUES (?, ?, ?)').run(woExtra, 'Déplacement urgent', 150);
      db.prepare('INSERT OR IGNORE INTO work_order_extra_fees (work_order_id, description, amount) VALUES (?, ?, ?)').run(woExtra, 'Fourniture spéciale', 80);
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('work_order_extra_fees:', e.message);
  }

  try {
    const woOp = db.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-002')?.id;
    if (woOp && techIdDev) db.prepare('INSERT OR IGNORE INTO work_order_operators (work_order_id, user_id, role) VALUES (?, ?, ?)').run(woOp, techIdDev, 'technician');
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('work_order_operators:', e.message);
  }

  try {
    const budIdAlert = db.prepare('SELECT id FROM budgets LIMIT 1').get()?.id || db.prepare('SELECT id FROM maintenance_budgets LIMIT 1').get()?.id;
    if (budIdAlert) db.prepare('INSERT OR IGNORE INTO alerts (alert_type, severity, title, message, entity_type, entity_id, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)')
      .run('budget_exceeded', 'warning', 'Budget dépassé', 'Dépassement budget maintenance Q1', 'budget', budIdAlert);
    const eqAlert = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-002')?.id;
    if (eqAlert) db.prepare('INSERT OR IGNORE INTO alerts (alert_type, severity, title, message, entity_type, entity_id, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)')
      .run('maintenance_due', 'info', 'Contrôle convoyeur', 'Inspection trimestrielle à planifier', 'equipment', eqAlert);
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('alerts (budget/equipment):', e.message);
  }

  try {
    const woRes = db.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-002')?.id;
    const partRes = db.prepare('SELECT id FROM spare_parts LIMIT 1').get()?.id;
    if (woRes && partRes) db.prepare('INSERT OR IGNORE INTO work_order_reservations (work_order_id, spare_part_id, quantity) VALUES (?, ?, ?)').run(woRes, partRes, 1);
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('work_order_reservations:', e.message);
  }

  try {
    const eq4Id = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-004')?.id;
    const inspTypeId = db.prepare('SELECT id FROM work_order_types WHERE name = ?').get('Inspection')?.id;
    const prevTypeId = db.prepare('SELECT id FROM work_order_types WHERE name = ?').get('Préventif')?.id;
    const eq3Id = db.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-003')?.id;
    if (inspTypeId) db.prepare('INSERT OR IGNORE INTO work_orders (number, title, description, equipment_id, type_id, status, priority, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('OT-2025-004', 'Inspection pompe PC-200', 'Contrôle vibrations et température', eq4Id || null, inspTypeId, 'pending', 'low', techIdDev);
    if (prevTypeId && eq3Id) db.prepare('INSERT OR IGNORE INTO work_orders (number, title, equipment_id, type_id, status, priority) VALUES (?, ?, ?, ?, ?, ?)')
      .run('OT-2025-005', 'Révision transformateur', eq3Id, prevTypeId, 'deferred', 'medium');
  } catch (e) {
    if (!e.message?.includes('no such table') && !e.message?.includes('UNIQUE')) console.warn('work_orders (extra):', e.message);
  }

  try {
    db.prepare("INSERT OR IGNORE INTO units (code, name, symbol) VALUES ('unit', 'Unité', 'u')").run();
    db.prepare("INSERT OR IGNORE INTO units (code, name, symbol) VALUES ('L', 'Litre', 'L')").run();
    db.prepare("INSERT OR IGNORE INTO units (code, name, symbol) VALUES ('m', 'Mètre', 'm')").run();
  } catch (e) {
    if (!e.message?.includes('no such table') && !e.message?.includes('UNIQUE')) console.warn('units:', e.message);
  }

  try {
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('hourly_rate', '45')").run();
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('currency', 'EUR')").run();
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('app_settings:', e.message);
  }

  try {
    db.prepare("INSERT OR IGNORE INTO competencies (code, name, description) VALUES ('MEC', 'Mécanique', 'Compétences mécaniques')").run();
    db.prepare("INSERT OR IGNORE INTO competencies (code, name, description) VALUES ('ELEC', 'Électricité', 'Compétences électriques')").run();
    db.prepare("INSERT OR IGNORE INTO competencies (code, name, description) VALUES ('HYD', 'Hydraulique', 'Circuits hydrauliques et dépannage')").run();
    db.prepare("INSERT OR IGNORE INTO competencies (code, name, description) VALUES ('PNEU', 'Pneumatique', 'Circuits pneumatiques')").run();
    db.prepare("INSERT OR IGNORE INTO competencies (code, name, description) VALUES ('SOUDEUR', 'Soudure', 'Soudure à l''arc et TIG')").run();
    const compMec = db.prepare('SELECT id FROM competencies WHERE code = ?').get('MEC')?.id;
    const compElec = db.prepare('SELECT id FROM competencies WHERE code = ?').get('ELEC')?.id;
    const compHyd = db.prepare('SELECT id FROM competencies WHERE code = ?').get('HYD')?.id;
    const compPneu = db.prepare('SELECT id FROM competencies WHERE code = ?').get('PNEU')?.id;
    const compSoud = db.prepare('SELECT id FROM competencies WHERE code = ?').get('SOUDEUR')?.id;
    const typeCorrectif = db.prepare('SELECT id FROM work_order_types WHERE name = ?').get('Correctif')?.id;
    const typePreventif = db.prepare('SELECT id FROM work_order_types WHERE name = ?').get('Préventif')?.id;
    if (techIdDev && compMec) db.prepare('INSERT OR IGNORE INTO technician_competencies (user_id, competence_id, level) VALUES (?, ?, ?)').run(techIdDev, compMec, 3);
    if (techIdDev && compElec) db.prepare('INSERT OR IGNORE INTO technician_competencies (user_id, competence_id, level) VALUES (?, ?, ?)').run(techIdDev, compElec, 2);
    if (techIdDev && compHyd) db.prepare('INSERT OR IGNORE INTO technician_competencies (user_id, competence_id, level) VALUES (?, ?, ?)').run(techIdDev, compHyd, 3);
    const tech2Id = db.prepare('SELECT id FROM users WHERE email = ?').get('technicien2@xmaint.org')?.id;
    const tech3Id = db.prepare('SELECT id FROM users WHERE email = ?').get('technicien3@xmaint.org')?.id;
    if (tech2Id && compMec) db.prepare('INSERT OR IGNORE INTO technician_competencies (user_id, competence_id, level) VALUES (?, ?, ?)').run(tech2Id, compMec, 4);
    if (tech2Id && compPneu) db.prepare('INSERT OR IGNORE INTO technician_competencies (user_id, competence_id, level) VALUES (?, ?, ?)').run(tech2Id, compPneu, 3);
    if (tech3Id && compElec) db.prepare('INSERT OR IGNORE INTO technician_competencies (user_id, competence_id, level) VALUES (?, ?, ?)').run(tech3Id, compElec, 4);
    if (tech3Id && compSoud) db.prepare('INSERT OR IGNORE INTO technician_competencies (user_id, competence_id, level) VALUES (?, ?, ?)').run(tech3Id, compSoud, 2);
    if (typeCorrectif && compMec) db.prepare('INSERT OR IGNORE INTO type_competencies (work_order_type_id, competence_id, required_level) VALUES (?, ?, ?)').run(typeCorrectif, compMec, 2);
    if (typePreventif && compMec) db.prepare('INSERT OR IGNORE INTO type_competencies (work_order_type_id, competence_id, required_level) VALUES (?, ?, ?)').run(typePreventif, compMec, 1);
    if (typeCorrectif && compElec) db.prepare('INSERT OR IGNORE INTO type_competencies (work_order_type_id, competence_id, required_level) VALUES (?, ?, ?)').run(typeCorrectif, compElec, 1);
    if (techIdDev && respIdDev) {
      const woEval = db.prepare('SELECT id FROM work_orders LIMIT 1').get()?.id;
      db.prepare('INSERT OR IGNORE INTO technician_evaluations (technician_id, evaluator_id, work_order_id, score, comment) VALUES (?, ?, ?, ?, ?)')
        .run(techIdDev, respIdDev, woEval || null, 4, 'Bon travail');
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('competencies/technician_*:', e.message);
  }

  try {
    const woSla = db.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-002')?.id;
    if (woSla) db.prepare('INSERT OR IGNORE INTO sla_escalation_log (work_order_id) VALUES (?)').run(woSla);
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('sla_escalation_log:', e.message);
  }

  try {
    const validUntil = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    if (techIdDev) db.prepare('INSERT OR IGNORE INTO technician_trainings (technician_id, name, description, completed_date, valid_until, issuer) VALUES (?, ?, ?, ?, ?, ?)')
      .run(techIdDev, 'Habilitation électrique B1V', 'Niveau basse tension', new Date().toISOString().slice(0, 10), validUntil, 'Organisme agréé');
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('technician_trainings:', e.message);
  }

  try {
    const wo1 = db.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-001')?.id;
    const wo2 = db.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-002')?.id;
    if (wo1 && wo2) db.prepare('INSERT OR IGNORE INTO work_order_links (work_order_id, linked_work_order_id, link_type) VALUES (?, ?, ?)').run(wo1, wo2, 'related');
  } catch (e) {
    if (!e.message?.includes('no such table') && !e.message?.includes('UNIQUE')) console.warn('work_order_links:', e.message);
  }

  try {
    const woAtt = db.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-001')?.id;
    if (woAtt && userIdDev) db.prepare('INSERT OR IGNORE INTO work_order_attachments (work_order_id, file_name, file_path, attachment_type, uploaded_by) VALUES (?, ?, ?, ?, ?)')
      .run(woAtt, 'photo-avant.jpg', '/uploads/wo/photo-avant.jpg', 'photo_before', userIdDev);
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('work_order_attachments:', e.message);
  }

  try {
    const locId = db.prepare('SELECT id FROM stock_locations WHERE code = ?').get('EMP-A1')?.id;
    const partIdLoc = db.prepare('SELECT id FROM spare_parts LIMIT 1').get()?.id;
    if (locId && partIdLoc) db.prepare('INSERT OR IGNORE INTO spare_part_locations (spare_part_id, location_id, quantity_reserved) VALUES (?, ?, ?)').run(partIdLoc, locId, 5);
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('spare_part_locations:', e.message);
  }

  try {
    const partLot = db.prepare('SELECT id FROM spare_parts LIMIT 1').get()?.id;
    const locLot = db.prepare('SELECT id FROM stock_locations WHERE code = ?').get('EMP-A1')?.id;
    if (partLot) db.prepare('INSERT OR IGNORE INTO stock_lot_serial (spare_part_id, lot_number, quantity, location_id) VALUES (?, ?, ?, ?)').run(partLot, 'LOT-2025-001', 20, locLot || null);
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('stock_lot_serial:', e.message);
  }

  try {
    const partQc = db.prepare('SELECT id FROM spare_parts LIMIT 1').get()?.id;
    if (partQc && userIdDev) db.prepare('INSERT OR IGNORE INTO quality_control_log (spare_part_id, quantity, action, user_id, notes) VALUES (?, ?, ?, ?, ?)').run(partQc, 10, 'release', userIdDev, 'Contrôle réception OK');
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('quality_control_log:', e.message);
  }

  try {
    const chkIdWo = db.prepare('SELECT id FROM maintenance_checklists LIMIT 1').get()?.id;
    const woIdChk = db.prepare('SELECT id FROM work_orders LIMIT 1').get()?.id;
    if (chkIdWo && woIdChk) db.prepare('INSERT OR IGNORE INTO work_order_checklists (work_order_id, checklist_id) VALUES (?, ?)').run(woIdChk, chkIdWo);
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('work_order_checklists:', e.message);
  }

  // ——— Phase finale : au moins une ligne dans chaque table avec liens FK valides ———
  (function ensureAllTablesFilledWithLinks() {
    const id = (table, col = 'id') => {
      try { return db.prepare(`SELECT ${col} FROM ${table} LIMIT 1`).get()?.[col] ?? null; } catch (_) { return null; }
    };
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const sid = id('sites');
    const lid = id('lignes'); const depId = id('departements'); const catId = id('equipment_categories');
    const eqId = id('equipment'); const eq2 = db.prepare('SELECT id FROM equipment ORDER BY id LIMIT 1 OFFSET 1').get()?.id || eqId;
    const uid = id('users'); const techId = db.prepare('SELECT id FROM users WHERE email = ?').get('technicien@xmaint.org')?.id || uid;
    const respId = db.prepare('SELECT id FROM users WHERE email = ?').get('responsable@xmaint.org')?.id || uid;
    const suppId = id('suppliers'); const partId = id('spare_parts'); const part2 = db.prepare('SELECT id FROM spare_parts LIMIT 1 OFFSET 1').get()?.id || partId;
    const woId = id('work_orders'); const wo2 = db.prepare('SELECT id FROM work_orders ORDER BY id LIMIT 1 OFFSET 1').get()?.id || woId;
    const planId = id('maintenance_plans'); const typeId = id('work_order_types'); const projId = id('maintenance_projects');
    const chkId = id('maintenance_checklists'); const procId = id('procedures'); const locId = id('stock_locations');
    const famId = id('part_families'); const brandId = id('brands'); const catPartId = id('part_categories');
    const contractorId = id('external_contractors'); const catalogId = id('training_catalog'); const kpiDefId = id('kpi_definitions');
    const failCodeId = id('failure_codes'); const skillId = id('skills'); const compId = id('competencies');
    const toolId = id('tools'); const year = new Date().getFullYear();

    const run = (fn) => { try { fn(); } catch (e) { if (!e.message?.includes('UNIQUE') && !e.message?.includes('duplicate')) console.warn('[seed]', e.message); } };

    if (!sid) return;
    run(() => db.prepare('INSERT OR IGNORE INTO lignes (site_id, code, name) VALUES (?, ?, ?)').run(sid, 'L3', 'Ligne test'));
    if (eqId && planId) run(() => db.prepare('INSERT OR IGNORE INTO work_orders (number, title, equipment_id, type_id, status, maintenance_plan_id, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?)').run('OT-2025-006', 'OT lié plan', eqId, typeId, 'pending', planId, techId));
    if (woId && partId && uid) run(() => db.prepare('INSERT OR IGNORE INTO interventions (work_order_id, description, hours_spent, spare_part_id, quantity_used, technician_id) VALUES (?, ?, ?, ?, ?, ?)').run(woId, 'Intervention test', 1, partId, 1, techId));
    if (suppId && uid) run(() => db.prepare('INSERT OR IGNORE INTO supplier_orders (order_number, supplier_id, status, order_date, expected_date, total_amount, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)').run('CMD-TEST-001', suppId, 'draft', today, today, 0, uid));
    const orderId = db.prepare('SELECT id FROM supplier_orders ORDER BY id DESC LIMIT 1').get()?.id;
    if (orderId && partId) run(() => db.prepare('INSERT OR IGNORE INTO supplier_order_lines (order_id, spare_part_id, quantity, unit_price) VALUES (?, ?, ?, ?)').run(orderId, partId, 5, 10));
    if (eqId && partId) run(() => db.prepare('INSERT OR IGNORE INTO equipment_spare_parts (equipment_id, spare_part_id, quantity) VALUES (?, ?, ?)').run(eqId, partId, 1));
    if (partId && uid) run(() => db.prepare('INSERT OR IGNORE INTO stock_movements (spare_part_id, quantity, movement_type, reference, user_id, notes) VALUES (?, ?, ?, ?, ?, ?)').run(partId, 10, 'in', 'INIT', uid, 'Stock initial'));
    if (eqId && uid) run(() => db.prepare('INSERT OR IGNORE INTO documents (entity_type, entity_id, filename, original_filename, file_path, document_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)').run('equipment', eqId, 'doc-eq.pdf', 'Doc.pdf', '/docs/doc-eq.pdf', 'manual', uid));
    if (suppId && eqId) run(() => db.prepare('INSERT OR IGNORE INTO maintenance_contracts (contract_number, name, supplier_id, equipment_id, contract_type, start_date, end_date, annual_cost, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('CT-TEST', 'Contrat test', suppId, eqId, 'preventive', today, today, 5000, 1));
    if (uid) run(() => db.prepare('INSERT OR IGNORE INTO alerts (alert_type, severity, title, message, entity_type, is_read) VALUES (?, ?, ?, ?, ?, ?)').run('info', 'info', 'Alerte test', 'Message', 'system', 0));
    if (skillId && techId) run(() => db.prepare('INSERT OR IGNORE INTO user_skills (user_id, skill_id, level) VALUES (?, ?, ?)').run(techId, skillId, 'basic'));
    if (eqId && skillId) run(() => db.prepare('INSERT OR IGNORE INTO equipment_required_skills (equipment_id, skill_id, required_level) VALUES (?, ?, ?)').run(eqId, skillId, 'basic'));
    if (toolId && woId && techId) run(() => db.prepare('INSERT OR IGNORE INTO tool_assignments (tool_id, work_order_id, assigned_to) VALUES (?, ?, ?)').run(toolId, woId, techId));
    if (planId && chkId) run(() => db.prepare('INSERT OR IGNORE INTO maintenance_checklists (maintenance_plan_id, name, description) VALUES (?, ?, ?)').run(planId, 'Checklist test', 'Desc'));
    const chk2 = db.prepare('SELECT id FROM maintenance_checklists ORDER BY id DESC LIMIT 1').get()?.id || chkId;
    if (chk2) run(() => db.prepare('INSERT OR IGNORE INTO checklist_items (checklist_id, item_text, item_type, order_index) VALUES (?, ?, ?, ?)').run(chk2, 'Point contrôle', 'check', 1));
    if (chkId && woId && uid) run(() => db.prepare('INSERT OR IGNORE INTO checklist_executions (checklist_id, work_order_id, executed_by) VALUES (?, ?, ?)').run(chkId, woId, uid));
    const execId = db.prepare('SELECT id FROM checklist_executions LIMIT 1').get()?.id;
    const itemId = db.prepare('SELECT id FROM checklist_items LIMIT 1').get()?.id;
    if (execId && itemId) run(() => db.prepare('INSERT OR IGNORE INTO checklist_item_results (execution_id, item_id, value, is_ok) VALUES (?, ?, ?, ?)').run(execId, itemId, null, 1));
    if (eqId && suppId) run(() => db.prepare('INSERT OR IGNORE INTO warranties (warranty_number, equipment_id, supplier_id, warranty_type, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)').run('GAR-TEST', eqId, suppId, 'parts', today, today, 1));
    const wStart = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    const wEnd = new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    if (sid && uid) run(() => db.prepare('INSERT OR IGNORE INTO planned_shutdowns (shutdown_number, name, site_id, start_date, end_date, duration_hours, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('ARR-TEST', 'Arrêt test', sid, wStart, wEnd, 8, 'planned', uid));
    const shutId = db.prepare('SELECT id FROM planned_shutdowns LIMIT 1').get()?.id;
    if (shutId && woId) run(() => db.prepare('INSERT OR IGNORE INTO shutdown_work_orders (shutdown_id, work_order_id) VALUES (?, ?)').run(shutId, woId));
    if (uid) run(() => db.prepare('INSERT OR IGNORE INTO budgets (budget_number, name, start_date, end_date, allocated_budget, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)').run('BUD-TEST', 'Budget test', today, today, 10000, 'draft', uid));
    const budId = db.prepare('SELECT id FROM budgets LIMIT 1').get()?.id;
    if (budId) run(() => db.prepare('INSERT OR IGNORE INTO budget_items (budget_id, item_type, description, planned_amount, category) VALUES (?, ?, ?, ?, ?)').run(budId, 'work_order', 'MO', 5000, 'labor'));
    if (uid && locId) run(() => db.prepare('INSERT OR IGNORE INTO stock_inventories (reference, inventory_date, responsible_id, status) VALUES (?, ?, ?, ?)').run('INV-TEST', today, uid, 'draft'));
    const invId = db.prepare('SELECT id FROM stock_inventories LIMIT 1').get()?.id;
    if (invId && partId) run(() => db.prepare('INSERT OR IGNORE INTO stock_inventory_lines (inventory_id, spare_part_id, quantity_system, quantity_counted) VALUES (?, ?, ?, ?)').run(invId, partId, 20, 20));
    if (partId && uid) run(() => db.prepare('INSERT OR IGNORE INTO reorder_requests (spare_part_id, quantity_requested, status, requested_by) VALUES (?, ?, ?, ?)').run(partId, 10, 'pending', uid));
    if (typeId && compId) run(() => db.prepare('INSERT OR IGNORE INTO type_competencies (work_order_type_id, competence_id, required_level) VALUES (?, ?, ?)').run(typeId, compId, 1));
    if (uid) run(() => db.prepare('INSERT OR IGNORE INTO notification_preferences (user_id, channel, event_type, enabled) VALUES (?, ?, ?, ?)').run(uid, 'email', 'work_order_created', 1));
    if (eqId && uid) run(() => db.prepare('INSERT OR IGNORE INTO intervention_requests (title, description, equipment_id, requested_by, priority, status) VALUES (?, ?, ?, ?, ?, ?)').run('Demande test', 'Desc', eqId, uid, 'medium', 'pending'));
    if (woId) run(() => db.prepare('INSERT OR IGNORE INTO sla_escalation_log (work_order_id) VALUES (?)').run(woId));
    if (eqId) run(() => db.prepare('INSERT OR REPLACE INTO equipment_counters (equipment_id, counter_type, value, unit) VALUES (?, ?, ?, ?)').run(eqId, 'hours', 1000, 'h'));
    if (eqId) run(() => db.prepare('INSERT OR IGNORE INTO equipment_thresholds (equipment_id, metric, threshold_value, operator, create_wo_on_breach) VALUES (?, ?, ?, ?, ?)').run(eqId, 'hours', 5000, '>=', 0));
    if (woId && partId) run(() => db.prepare('INSERT OR IGNORE INTO work_order_reservations (work_order_id, spare_part_id, quantity) VALUES (?, ?, ?)').run(woId, partId, 1));
    if (woId && uid) run(() => db.prepare('INSERT OR IGNORE INTO audit_log (entity_type, entity_id, action, user_id, summary) VALUES (?, ?, ?, ?, ?)').run('work_order', String(woId), 'created', uid, 'Création'));
    if (sid) run(() => db.prepare('INSERT OR IGNORE INTO maintenance_projects (name, description, site_id, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?)').run('Projet test', 'Desc', sid, today, today, 'draft'));
    if (catId) run(() => db.prepare('INSERT OR IGNORE INTO equipment_models (name, manufacturer, model, category_id) VALUES (?, ?, ?, ?)').run('Modèle test', 'Fab', 'M1', catId));
    if (woId && procId) run(() => db.prepare('INSERT OR IGNORE INTO work_order_procedures (work_order_id, procedure_id) VALUES (?, ?)').run(woId, procId));
    if (woId && chkId) run(() => db.prepare('INSERT OR IGNORE INTO work_order_checklists (work_order_id, checklist_id) VALUES (?, ?)').run(woId, chkId));
    if (techId) run(() => db.prepare('INSERT OR IGNORE INTO technician_trainings (technician_id, name, completed_date, valid_until) VALUES (?, ?, ?, ?)').run(techId, 'Formation test', today, today));
    if (partId && uid) run(() => db.prepare('INSERT OR IGNORE INTO quality_control_log (spare_part_id, quantity, action, user_id, notes) VALUES (?, ?, ?, ?, ?)').run(partId, 5, 'release', uid, 'OK'));
    if (sid) run(() => db.prepare('INSERT OR IGNORE INTO stock_locations (code, name, site_id) VALUES (?, ?, ?)').run('EMP-TEST', 'Emplacement test', sid));
    if (partId && locId) run(() => db.prepare('INSERT OR IGNORE INTO spare_part_locations (spare_part_id, location_id, quantity_reserved) VALUES (?, ?, ?)').run(partId, locId, 0));
    if (partId && woId && uid) run(() => db.prepare('INSERT OR IGNORE INTO stock_reservations (spare_part_id, work_order_id, quantity, status, reserved_by) VALUES (?, ?, ?, ?, ?)').run(partId, woId, 1, 'reserved', uid));
    if (partId) run(() => db.prepare('INSERT OR IGNORE INTO stock_lot_serial (spare_part_id, lot_number, quantity) VALUES (?, ?, ?)').run(partId, 'LOT-TEST', 10));
    if (kpiDefId && sid) run(() => db.prepare('INSERT OR IGNORE INTO kpi_targets (kpi_definition_id, site_id, year, target_value, unit) VALUES (?, ?, ?, ?, ?)').run(kpiDefId, sid, year, 90, '%'));
    if (sid && partId) run(() => db.prepare('INSERT OR IGNORE INTO stock_by_site (site_id, spare_part_id, quantity) VALUES (?, ?, ?)').run(sid, partId, 10));
    if (eqId) run(() => db.prepare('INSERT OR IGNORE INTO equipment_counter_history (equipment_id, counter_type, value, recorded_at, source) VALUES (?, ?, ?, ?, ?)').run(eqId, 'hours', 990, now, 'manual'));
    if (techId) run(() => db.prepare('INSERT OR IGNORE INTO time_entries (technician_id, occurred_at, type, source) VALUES (?, ?, ?, ?)').run(techId, now, 'in', 'manual'));
    if (techId) run(() => db.prepare('INSERT OR IGNORE INTO attendance_overrides (technician_id, date, status, comment) VALUES (?, ?, ?, ?)').run(techId, today, 'leave', 'Congés'));
    if (woId && partId) run(() => db.prepare('INSERT OR IGNORE INTO work_order_consumed_parts (work_order_id, spare_part_id, quantity, unit_cost_at_use) VALUES (?, ?, ?, ?)').run(woId, partId, 1, 10));
    run(() => db.prepare("INSERT OR IGNORE INTO scheduled_reports (report_type, frequency, recipient_emails, next_run_at, is_active) VALUES ('test', 'daily', 'admin@test.org', ?, 1)").run(now));
    if (techId) run(() => db.prepare('INSERT OR IGNORE INTO technician_badges (technician_id, badge_code) VALUES (?, ?)').run(techId, 'BADGE-999'));
    if (catId) run(() => db.prepare("INSERT OR IGNORE INTO required_document_types (entity_type, entity_id, document_type_name, is_mandatory) VALUES ('equipment_category', ?, ?, 1)").run(catId, 'Notice'));
    if (woId) run(() => db.prepare('INSERT OR IGNORE INTO work_order_extra_fees (work_order_id, description, amount) VALUES (?, ?, ?)').run(woId, 'Frais test', 50));
    if (woId && techId) run(() => db.prepare('INSERT OR IGNORE INTO work_order_operators (work_order_id, user_id, role) VALUES (?, ?, ?)').run(woId, techId, 'technician'));
    if (woId && eqId && uid) run(() => db.prepare('INSERT OR IGNORE INTO equipment_root_causes (work_order_id, equipment_id, root_cause_code, root_cause_description, created_by) VALUES (?, ?, ?, ?, ?)').run(woId, eqId, 'TEST', 'Cause test', uid));
    if (woId && wo2 && woId !== wo2) run(() => db.prepare('INSERT OR IGNORE INTO work_order_links (work_order_id, linked_work_order_id, link_type) VALUES (?, ?, ?)').run(woId, wo2, 'related'));
    if (woId && uid) run(() => db.prepare('INSERT OR IGNORE INTO work_order_attachments (work_order_id, file_name, file_path, attachment_type, uploaded_by) VALUES (?, ?, ?, ?, ?)').run(woId, 'fichier.pdf', '/uploads/f.pdf', 'document', uid));
    if (woId) run(() => db.prepare('INSERT OR IGNORE INTO work_order_phase_times (work_order_id, phase_name, hours_spent) VALUES (?, ?, ?)').run(woId, 'essai', 0.25));
    if (contractorId && woId && uid) run(() => db.prepare('INSERT OR IGNORE INTO subcontract_orders (number, contractor_id, work_order_id, description, status, order_date, expected_date, amount, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('ST-TEST-001', contractorId, woId, 'ST test', 'draft', today, today, 500, uid));
    if (techId && catalogId) run(() => db.prepare('INSERT OR IGNORE INTO training_plans (technician_id, training_catalog_id, planned_date, status) VALUES (?, ?, ?, ?)').run(techId, catalogId, today, 'planned'));
    if (woId) run(() => db.prepare('INSERT OR IGNORE INTO satisfaction_surveys (work_order_id, rating, comment) VALUES (?, ?, ?)').run(woId, 5, 'Très bien'));
    if (sid || projId) run(() => db.prepare('INSERT OR IGNORE INTO maintenance_budgets (name, site_id, project_id, year, amount, currency) VALUES (?, ?, ?, ?, ?, ?)').run('Budget test ' + year, sid, projId, year, 20000, 'EUR'));
    if (db._save) db._save();
  })();

  console.log('✅ Données de démo créées');
  console.log('\nTables avec données de test (base client default.db) :');
  console.log('  Init: roles, users, sites, lignes, equipment_categories, equipment, suppliers, spare_parts, stock_movements, stock_balance, maintenance_plans, work_order_types, work_orders, interventions, supplier_orders, supplier_order_lines, equipment_spare_parts');
  console.log('  + departements, documents, maintenance_contracts, alerts, skills, user_skills, equipment_required_skills, tools, tool_assignments, maintenance_checklists, checklist_items, checklist_executions, checklist_item_results, warranties, planned_shutdowns, shutdown_work_orders, budgets, budget_items');
  console.log('  + failure_codes, app_settings, stock_inventories, stock_inventory_lines, reorder_requests, competencies, technician_competencies, type_competencies, technician_evaluations, notification_preferences, intervention_requests, sla_escalation_log, equipment_counters, equipment_thresholds, work_order_reservations, audit_log, maintenance_projects, equipment_models, procedures, work_order_procedures, work_order_checklists, technician_trainings, quality_control_log, work_order_operators, units, kpi_targets');
  console.log('  + part_families, brands, maintenance_budgets, external_contractors, subcontract_orders, training_catalog, training_plans, satisfaction_surveys, equipment_root_causes, work_order_templates, work_order_links, work_order_attachments, work_order_phase_times, stock_locations, spare_part_locations, stock_reservations, stock_lot_serial, email_templates');
  console.log('  + work_order_extra_fees, part_categories, part_sub_families, time_entries, attendance_overrides, work_order_consumed_parts, scheduled_reports, technician_badges, equipment_counter_history, stock_by_site, required_document_types');
  console.log('  (kpi_definitions et indicator_targets : valeurs par défaut insérées par les migrations 038 et 041)');
  console.log('\nComptes de test (mot de passe: Password123!)');
  console.log('  - admin@xmaint.org (Administrateur)');
  console.log('  - responsable@xmaint.org (Responsable maintenance)');
  console.log('  - technicien@xmaint.org, technicien2@xmaint.org, technicien3@xmaint.org (Techniciens)');
  console.log('  - user@xmaint.org (Utilisateur)');
  console.log('  Effectif : pointage, présence, formations, compétences. Coût période : OT clôturés avec actual_end + budget_period.');
}

module.exports = { runSeed };

// N'exécuter seed() que si le fichier est lancé en CLI (npm run seed), pas à l'import par le serveur
if (require.main === module) {
  seed().catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
  });
}
