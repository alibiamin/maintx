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
  const db = require('./db');
  await db.init();
  const adminDb = db.getAdminDb();
  if (!fs.existsSync(adminDb.getPath ? adminDb.getPath() : dbPath)) {
    console.error('❌ Base de données non trouvée. Exécutez: npm run init-db puis npm run migrate');
    process.exit(1);
  }

  console.log('🌱 Peuplement de la base de données (gmao.db)...');

  const roles = [
    { name: 'administrateur', description: 'Accès complet au système' },
    { name: 'responsable_maintenance', description: 'Gestion des équipes et ordres de travail' },
    { name: 'technicien', description: 'Exécution des interventions' },
    { name: 'utilisateur', description: 'Consultation et déclaration de pannes' }
  ];

  for (const r of roles) {
    adminDb.prepare('INSERT OR IGNORE INTO roles (name, description) VALUES (?, ?)').run(r.name, r.description);
  }

  const roleIds = {};
  adminDb.prepare('SELECT id, name FROM roles').all().forEach(r => { roleIds[r.name] = r.id; });

  const passwordHash = await bcrypt.hash('Password123!', 10);
  const users = [
    { email: 'admin@xmaint.org', firstName: 'Admin', lastName: 'Système', role: 'administrateur' },
    { email: 'responsable@xmaint.org', firstName: 'Jean', lastName: 'Responsable', role: 'responsable_maintenance' },
    { email: 'technicien@xmaint.org', firstName: 'Pierre', lastName: 'Technicien', role: 'technicien' },
    { email: 'user@xmaint.org', firstName: 'Marie', lastName: 'Utilisatrice', role: 'utilisateur' }
  ];

  for (const u of users) {
    adminDb.prepare('INSERT OR IGNORE INTO users (email, password_hash, first_name, last_name, role_id) VALUES (?, ?, ?, ?, ?)')
      .run(u.email, passwordHash, u.firstName, u.lastName, roleIds[u.role]);
  }

  const woTypes = [
    { name: 'Préventif', color: '#4caf50' },
    { name: 'Correctif', color: '#f44336' },
    { name: 'Inspection', color: '#2196f3' },
    { name: 'Amélioration', color: '#ff9800' }
  ];
  for (const t of woTypes) {
    adminDb.prepare('INSERT OR IGNORE INTO work_order_types (name, color) VALUES (?, ?)').run(t.name, t.color);
  }

  // Sites et Lignes
  adminDb.prepare("INSERT OR IGNORE INTO sites (code, name, address) VALUES ('SITE-01', 'Usine principale', 'Zone industrielle')").run();
  const siteId = adminDb.prepare('SELECT id FROM sites WHERE code = ?').get('SITE-01')?.id;
  if (siteId) {
    adminDb.prepare('INSERT OR IGNORE INTO lignes (site_id, code, name) VALUES (?, ?, ?)').run(siteId, 'L1', 'Ligne assemblage');
    adminDb.prepare('INSERT OR IGNORE INTO lignes (site_id, code, name) VALUES (?, ?, ?)').run(siteId, 'L2', 'Ligne conditionnement');
  }
  const ligneIds = adminDb.prepare('SELECT id, code FROM lignes').all().reduce((acc, r) => { acc[r.code] = r.id; return acc; }, {});

  // Étape 1 : Départements (si table existe) + second site
  try {
    adminDb.prepare("INSERT OR IGNORE INTO sites (code, name, address) VALUES ('SITE-02', 'Entrepôt logistique', 'Avenue des Chênes')").run();
    const site2Id = adminDb.prepare('SELECT id FROM sites WHERE code = ?').get('SITE-02')?.id;
    if (siteId) {
      adminDb.prepare('INSERT OR IGNORE INTO departements (site_id, code, name, description) VALUES (?, ?, ?, ?)')
        .run(siteId, 'DEP-PROD', 'Production', 'Ateliers de production');
      adminDb.prepare('INSERT OR IGNORE INTO departements (site_id, code, name, description) VALUES (?, ?, ?, ?)')
        .run(siteId, 'DEP-ENERGIE', 'Énergie & fluides', 'Transformateurs, pompes');
    }
    if (site2Id) {
      adminDb.prepare('INSERT OR IGNORE INTO departements (site_id, code, name, description) VALUES (?, ?, ?, ?)')
        .run(site2Id, 'DEP-LOG', 'Logistique', 'Convoyeurs et stockage');
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Départements:', e.message);
  }
  const depIds = {};
  try {
    adminDb.prepare('SELECT id, code FROM departements').all().forEach(r => { depIds[r.code] = r.id; });
  } catch (e) {}

  const categories = [
    { name: 'Machines de production', parent: null },
    { name: 'Équipements électriques', parent: null },
    { name: 'Pompes et compresseurs', parent: null }
  ];
  for (const c of categories) {
    adminDb.prepare('INSERT OR IGNORE INTO equipment_categories (name, parent_id) VALUES (?, ?)').run(c.name, c.parent);
  }

  const catIds = adminDb.prepare('SELECT id, name FROM equipment_categories').all()
    .reduce((acc, r) => { acc[r.name] = r.id; return acc; }, {});

  const equipment = [
    { code: 'EQ-001', name: 'Presse hydraulique P500', category: 'Machines de production', serial: 'PH-2020-001', criticite: 'A', ligne: 'L1', dep: 'DEP-PROD', type: 'machine' },
    { code: 'EQ-002', name: 'Convoyeur principal', category: 'Machines de production', serial: 'CV-2019-045', criticite: 'A', ligne: 'L1', dep: 'DEP-PROD', type: 'machine' },
    { code: 'EQ-003', name: 'Transformateur 1000kVA', category: 'Équipements électriques', serial: 'TR-2021-012', criticite: 'A', ligne: null, dep: 'DEP-ENERGIE', type: 'machine' },
    { code: 'EQ-004', name: 'Pompe centrifuge PC-200', category: 'Pompes et compresseurs', serial: 'PC-2020-033', criticite: 'B', ligne: 'L2', dep: 'DEP-ENERGIE', type: 'machine' }
  ];

  const insEq = adminDb.prepare(`
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
      adminDb.prepare("INSERT OR IGNORE INTO equipment (code, name, category_id, ligne_id, serial_number, criticite, status) VALUES (?, ?, ?, ?, ?, ?, 'operational')")
        .run(e.code, e.name, catIds[e.category] || 1, e.ligne ? ligneIds[e.ligne] : null, e.serial, e.criticite || 'B');
    }
  }

  // Mise à jour des équipements existants (department_id, equipment_type) si colonnes présentes
  try {
    const updDept = adminDb.prepare('UPDATE equipment SET department_id = ?, equipment_type = ? WHERE code = ?');
    equipment.forEach(e => {
      if (e.dep && depIds[e.dep]) updDept.run(depIds[e.dep], e.type || 'machine', e.code);
    });
    adminDb._save();
  } catch (_) {}

  // Helper : insérer un équipement enfant (section, composant, sous_composant)
  const catDefault = catIds['Machines de production'] || 1;
  function insertChild(code, name, equipmentType, parentId) {
    try {
      adminDb.prepare(`
        INSERT OR IGNORE INTO equipment (code, name, category_id, parent_id, criticite, status, equipment_type)
        VALUES (?, ?, ?, ?, 'B', 'operational', ?)
      `).run(code, name, catDefault, parentId, equipmentType);
      return adminDb.prepare('SELECT id FROM equipment WHERE code = ?').get(code)?.id;
    } catch (e) {
      return null;
    }
  }

  // ——— Hiérarchie complète : Machine → Section → Composant → Sous-composant ———

  // EQ-001 Presse hydraulique : Sections → Composants → Sous-composants
  const eq001 = adminDb.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-001');
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
  const eq002 = adminDb.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-002');
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
  const eq003 = adminDb.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-003');
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
  const eq004 = adminDb.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-004');
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
  const eq005Id = adminDb.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-005');
  if (!eq005Id) {
    try {
      adminDb.prepare(`
        INSERT OR IGNORE INTO equipment (code, name, category_id, ligne_id, serial_number, criticite, status, equipment_type)
        VALUES ('EQ-005', 'Enrobeuse L2', ?, ?, 'ENR-2022-007', 'B', 'operational', 'machine')
      `).run(catDefault, ligneIds['L2'] || null);
    } catch (e) {}
  }
  const eq005 = adminDb.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-005');
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
    adminDb.prepare('INSERT OR IGNORE INTO suppliers (code, name, contact_person, email, phone) VALUES (?, ?, ?, ?, ?)')
      .run(s.code, s.name, s.contact, s.email, s.phone);
  }

  const spareParts = [
    { code: 'PR-001', name: 'Joint étanchéité PH', minStock: 5, unitPrice: 25.50 },
    { code: 'PR-002', name: 'Courroie transmission 1200mm', minStock: 3, unitPrice: 89.00 },
    { code: 'PR-003', name: 'Roulement 6205', minStock: 10, unitPrice: 15.00 },
    { code: 'PR-004', name: 'Filtre huile 10µ', minStock: 8, unitPrice: 45.00 }
  ];
  for (const p of spareParts) {
    adminDb.prepare('INSERT OR IGNORE INTO spare_parts (code, name, min_stock, unit_price) VALUES (?, ?, ?, ?)')
      .run(p.code, p.name, p.minStock, p.unitPrice);
  }

  const parts = adminDb.prepare('SELECT id FROM spare_parts').all();
  for (const p of parts) {
    adminDb.prepare('INSERT OR IGNORE INTO stock_balance (spare_part_id, quantity) VALUES (?, 20)').run(p.id);
  }

  const equipmentIds = adminDb.prepare('SELECT id FROM equipment LIMIT 2').all();
  if (equipmentIds.length >= 2) {
    const next30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    adminDb.prepare('INSERT OR IGNORE INTO maintenance_plans (equipment_id, name, description, frequency_days, next_due_date, is_active) VALUES (?, ?, ?, 30, ?, 1)')
      .run(equipmentIds[0].id, 'Lubrification mensuelle', 'Graissage des paliers', next30);
    adminDb.prepare('INSERT OR IGNORE INTO maintenance_plans (equipment_id, name, description, frequency_days, next_due_date, is_active) VALUES (?, ?, ?, 90, ?, 1)')
      .run(equipmentIds[1].id, 'Inspection trimestrielle', 'Contrôle général', next30);
  }

  const woTypeId = adminDb.prepare('SELECT id FROM work_order_types WHERE name = ?').get('Correctif')?.id || 1;
  const techId = adminDb.prepare('SELECT id FROM users WHERE email = ?').get('technicien@xmaint.org')?.id || 1;
  const eqId = adminDb.prepare('SELECT id FROM equipment LIMIT 1').get()?.id || 1;

  const workOrders = [
    { number: 'OT-2025-001', title: 'Réparation presse - fuite hydraulique', status: 'completed' },
    { number: 'OT-2025-002', title: 'Remplacement courroie convoyeur', status: 'in_progress' },
    { number: 'OT-2025-003', title: 'Lubrification préventive', status: 'pending' }
  ];

  for (const wo of workOrders) {
    adminDb.prepare('INSERT OR IGNORE INTO work_orders (number, title, equipment_id, type_id, status, assigned_to, priority) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(wo.number, wo.title, eqId, woTypeId, wo.status, techId, 'medium');
  }

  // Projets de maintenance (regroupement OT, budget)
  try {
    const siteIdProj = adminDb.prepare('SELECT id FROM sites WHERE code = ?').get('SITE-01')?.id;
    const site2IdProj = adminDb.prepare('SELECT id FROM sites WHERE code = ?').get('SITE-02')?.id;
    const startProj = new Date().toISOString().split('T')[0];
    const endProj = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const projectsSeed = [
      { name: 'Maintenance annuelle ligne 1', description: 'Regroupement des OT préventifs et correctifs sur la ligne assemblage', budget: 45000, siteId: siteIdProj, status: 'active' },
      { name: 'Projet énergie & fluides', description: 'Maintenance transformateurs et pompes', budget: 28000, siteId: siteIdProj, status: 'active' },
      { name: 'Logistique - Entrepôt', description: 'OT sur convoyeurs et stockage (SITE-02)', budget: 15000, siteId: site2IdProj, status: 'draft' }
    ];
    const insProj = adminDb.prepare(`
      INSERT INTO maintenance_projects (name, description, budget_amount, site_id, start_date, end_date, status)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM maintenance_projects WHERE name = ?)
    `);
    for (const p of projectsSeed) {
      insProj.run(p.name, p.description, p.budget, p.siteId || null, startProj, endProj, p.status, p.name);
    }

    const proj1Id = adminDb.prepare('SELECT id FROM maintenance_projects WHERE name = ?').get('Maintenance annuelle ligne 1')?.id;
    if (proj1Id) {
      adminDb.prepare('UPDATE work_orders SET project_id = ? WHERE number IN (?, ?)').run(proj1Id, 'OT-2025-001', 'OT-2025-002');
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Projets de maintenance:', e.message);
  }

  // Étape 2 : Documents, contrats de maintenance, alertes
  try {
    const userId = adminDb.prepare('SELECT id FROM users LIMIT 1').get()?.id || 1;
    const suppId = adminDb.prepare('SELECT id FROM suppliers LIMIT 1').get()?.id || 1;
    adminDb.prepare(`INSERT OR IGNORE INTO documents (entity_type, entity_id, filename, original_filename, file_path, document_type, description, uploaded_by)
      VALUES ('equipment', ?, 'notice-eq.pdf', 'Notice_P500.pdf', '/docs/notice-eq.pdf', 'manual', 'Notice constructeur', ?)`).run(eqId, userId);
    adminDb.prepare(`INSERT OR IGNORE INTO documents (entity_type, entity_id, filename, original_filename, file_path, document_type, uploaded_by)
      VALUES ('work_order', ?, 'photo-ot.jpg', 'fuite.jpg', '/docs/photo-ot.jpg', 'photo', ?)`).run(adminDb.prepare('SELECT id FROM work_orders LIMIT 1').get()?.id || 1, userId);

    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    adminDb.prepare(`INSERT OR IGNORE INTO maintenance_contracts (contract_number, name, supplier_id, equipment_id, contract_type, start_date, end_date, annual_cost, is_active)
      VALUES ('CT-2025-001', 'Contrat presse P500', ?, ?, 'preventive', ?, ?, 12000, 1)`).run(suppId, eqId, startDate, endDate);
    adminDb.prepare(`INSERT OR IGNORE INTO maintenance_contracts (contract_number, name, supplier_id, contract_type, start_date, end_date, annual_cost, is_active)
      VALUES ('CT-2025-002', 'Contrat pièces détachées', ?, 'spare_parts', ?, ?, 5000, 1)`).run(suppId, startDate, endDate);

    adminDb.prepare(`INSERT OR IGNORE INTO alerts (alert_type, severity, title, message, entity_type, entity_id, is_read)
      VALUES ('maintenance_due', 'warning', 'Maintenance à prévoir', 'Lubrification mensuelle EQ-001 due sous 30j', 'maintenance_plan', 1, 0)`).run();
    adminDb.prepare(`INSERT OR IGNORE INTO alerts (alert_type, severity, title, message, entity_type, is_read)
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
      adminDb.prepare('INSERT OR IGNORE INTO skills (name, category) VALUES (?, ?)').run(s.name, s.category);
    }
    const skillIds = adminDb.prepare('SELECT id, name FROM skills').all().reduce((acc, r) => { acc[r.name] = r.id; return acc; }, {});
    const techId2 = adminDb.prepare('SELECT id FROM users WHERE email = ?').get('technicien@xmaint.org')?.id;
    if (techId2 && skillIds['Mécanique']) {
      adminDb.prepare('INSERT OR IGNORE INTO user_skills (user_id, skill_id, level) VALUES (?, ?, ?)').run(techId2, skillIds['Mécanique'], 'advanced');
      adminDb.prepare('INSERT OR IGNORE INTO user_skills (user_id, skill_id, level) VALUES (?, ?, ?)').run(techId2, skillIds['Hydraulique'], 'intermediate');
    }
    const eq1 = adminDb.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-001')?.id;
    if (eq1 && skillIds['Hydraulique']) {
      adminDb.prepare('INSERT OR IGNORE INTO equipment_required_skills (equipment_id, skill_id, required_level) VALUES (?, ?, ?)').run(eq1, skillIds['Hydraulique'], 'intermediate');
      if (skillIds['Mécanique']) adminDb.prepare('INSERT OR IGNORE INTO equipment_required_skills (equipment_id, skill_id, required_level) VALUES (?, ?, ?)').run(eq1, skillIds['Mécanique'], 'basic');
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Compétences:', e.message);
  }

  // Étape 4 : Outils et affectations (tools, tool_assignments)
  try {
    const calDue = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    adminDb.prepare(`INSERT OR IGNORE INTO tools (code, name, tool_type, status, calibration_due_date) VALUES ('OUT-001', 'Clé dynamométrique 50Nm', 'hand_tool', 'available', ?)`).run(calDue);
    adminDb.prepare(`INSERT OR IGNORE INTO tools (code, name, tool_type, status) VALUES ('OUT-002', 'Multimètre Fluke', 'measuring', 'in_use')`).run();
    adminDb.prepare(`INSERT OR IGNORE INTO tools (code, name, tool_type, status) VALUES ('OUT-003', 'Casque anti-bruit', 'safety', 'available')`).run();
    const tool1 = adminDb.prepare('SELECT id FROM tools WHERE code = ?').get('OUT-001')?.id;
    const wo1 = adminDb.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-002')?.id;
    const techId3 = adminDb.prepare('SELECT id FROM users WHERE email = ?').get('technicien@xmaint.org')?.id;
    if (tool1 && wo1 && techId3) {
      adminDb.prepare('INSERT OR IGNORE INTO tool_assignments (tool_id, work_order_id, assigned_to) VALUES (?, ?, ?)').run(tool1, wo1, techId3);
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Outils:', e.message);
  }

  // Étape 5 : Checklists de maintenance
  try {
    const planId = adminDb.prepare('SELECT id FROM maintenance_plans LIMIT 1').get()?.id;
    if (planId) {
      adminDb.prepare('INSERT OR IGNORE INTO maintenance_checklists (maintenance_plan_id, name, description) VALUES (?, ?, ?)')
        .run(planId, 'Checklist lubrification', 'Points de graissage à contrôler');
      const chkId = adminDb.prepare('SELECT id FROM maintenance_checklists LIMIT 1').get()?.id;
      if (chkId) {
        adminDb.prepare('INSERT OR IGNORE INTO checklist_items (checklist_id, item_text, item_type, order_index) VALUES (?, ?, ?, ?)').run(chkId, 'Niveau huile vérifié', 'check', 1);
        adminDb.prepare('INSERT OR IGNORE INTO checklist_items (checklist_id, item_text, item_type, expected_value, unit, order_index) VALUES (?, ?, ?, ?, ?, ?)').run(chkId, 'Pression circuit (bar)', 'measurement', '150', 'bar', 2);
        const woId = adminDb.prepare('SELECT id FROM work_orders LIMIT 1').get()?.id;
        const techId4 = adminDb.prepare('SELECT id FROM users LIMIT 1').get()?.id;
        if (woId) {
          adminDb.prepare('INSERT OR IGNORE INTO checklist_executions (checklist_id, work_order_id, executed_by) VALUES (?, ?, ?)').run(chkId, woId, techId4);
          const execId = adminDb.prepare('SELECT id FROM checklist_executions LIMIT 1').get()?.id;
          const itemId = adminDb.prepare('SELECT id FROM checklist_items LIMIT 1').get()?.id;
          if (execId && itemId) {
            adminDb.prepare('INSERT OR IGNORE INTO checklist_item_results (execution_id, item_id, value, is_ok) VALUES (?, ?, ?, ?)').run(execId, itemId, null, 1);
          }
        }
      }
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Checklists:', e.message);
  }

  // Étape 6 : Garanties, arrêts planifiés (warranties, planned_shutdowns, shutdown_work_orders)
  try {
    const suppId2 = adminDb.prepare('SELECT id FROM suppliers LIMIT 1').get()?.id;
    const eqId2 = adminDb.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-001')?.id;
    const wStart = new Date().toISOString().split('T')[0];
    const wEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    if (eqId2 && suppId2) {
      adminDb.prepare(`INSERT OR IGNORE INTO warranties (warranty_number, equipment_id, supplier_id, warranty_type, start_date, end_date, coverage_description, is_active)
        VALUES ('GAR-001', ?, ?, 'parts', ?, ?, 'Pièces défectueuses', 1)`).run(eqId2, suppId2, wStart, wEnd);
    }
    const siteIdSh = adminDb.prepare('SELECT id FROM sites LIMIT 1').get()?.id;
    const userIdSh = adminDb.prepare('SELECT id FROM users LIMIT 1').get()?.id;
    const shStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const shEnd = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    if (siteIdSh && userIdSh) {
      adminDb.prepare(`INSERT OR IGNORE INTO planned_shutdowns (shutdown_number, name, site_id, start_date, end_date, duration_hours, status, created_by)
        VALUES ('ARR-2025-001', 'Maintenance annuelle ligne 1', ?, ?, ?, ?, 'planned', ?)`).run(siteIdSh, shStart, shEnd, 24, userIdSh);
      const shutId = adminDb.prepare('SELECT id FROM planned_shutdowns LIMIT 1').get()?.id;
      const woIdSh = adminDb.prepare('SELECT id FROM work_orders LIMIT 1').get()?.id;
      if (shutId && woIdSh) {
        adminDb.prepare('INSERT OR IGNORE INTO shutdown_work_orders (shutdown_id, work_order_id) VALUES (?, ?)').run(shutId, woIdSh);
      }
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Garanties/arrêts:', e.message);
  }

  // Étape 7 : Budgets et lignes (budgets, budget_items)
  try {
    const bStart = new Date().toISOString().split('T')[0];
    const bEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const userIdB = adminDb.prepare('SELECT id FROM users LIMIT 1').get()?.id;
    adminDb.prepare(`INSERT OR IGNORE INTO budgets (budget_number, name, description, project_type, start_date, end_date, allocated_budget, status, created_by)
      VALUES ('BUD-2025-001', 'Budget maintenance annuelle', 'Maintenance préventive et corrective', 'maintenance', ?, ?, 85000, 'approved', ?)`).run(bStart, bEnd, userIdB);
    const budId = adminDb.prepare('SELECT id FROM budgets LIMIT 1').get()?.id;
    if (budId) {
      adminDb.prepare('INSERT OR IGNORE INTO budget_items (budget_id, item_type, description, planned_amount, category) VALUES (?, ?, ?, ?, ?)').run(budId, 'contract', 'Contrats maintenance', 50000, 'external');
      adminDb.prepare('INSERT OR IGNORE INTO budget_items (budget_id, item_type, description, planned_amount, category) VALUES (?, ?, ?, ?, ?)').run(budId, 'work_order', 'Main d\'œuvre interne', 25000, 'labor');
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Budgets:', e.message);
  }

  // Étape 8 : Commandes fournisseurs, interventions, pièces-équipement, mouvements de stock
  try {
    const suppId3 = adminDb.prepare('SELECT id FROM suppliers LIMIT 1').get()?.id;
    const userId8 = adminDb.prepare('SELECT id FROM users LIMIT 1').get()?.id;
    const partIds = adminDb.prepare('SELECT id FROM spare_parts').all();
    if (suppId3 && userId8) {
      adminDb.prepare(`INSERT OR IGNORE INTO supplier_orders (order_number, supplier_id, status, order_date, expected_date, total_amount, created_by)
        VALUES ('CMD-2025-001', ?, 'sent', ?, ?, 1250.50, ?)`).run(
        suppId3,
        new Date().toISOString().split('T')[0],
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        userId8
      );
      const orderId = adminDb.prepare('SELECT id FROM supplier_orders LIMIT 1').get()?.id;
      if (orderId && partIds.length >= 2) {
        adminDb.prepare('INSERT OR IGNORE INTO supplier_order_lines (order_id, spare_part_id, quantity, unit_price) VALUES (?, ?, ?, ?)').run(orderId, partIds[0].id, 10, 25.50);
        adminDb.prepare('INSERT OR IGNORE INTO supplier_order_lines (order_id, spare_part_id, quantity, unit_price) VALUES (?, ?, ?, ?)').run(orderId, partIds[1].id, 2, 89);
      }
    }
    const woIdI = adminDb.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-001')?.id;
    if (woIdI && techId && partIds?.length) {
      adminDb.prepare('INSERT OR IGNORE INTO interventions (work_order_id, description, hours_spent, spare_part_id, quantity_used, technician_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(woIdI, 'Remplacement joint + purge', 2.5, partIds[0].id, 1, techId);
    }
    const eqIdEsp = adminDb.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-001')?.id;
    if (eqIdEsp && partIds?.length >= 2) {
      adminDb.prepare('INSERT OR IGNORE INTO equipment_spare_parts (equipment_id, spare_part_id, quantity) VALUES (?, ?, ?)').run(eqIdEsp, partIds[0].id, 2);
      adminDb.prepare('INSERT OR IGNORE INTO equipment_spare_parts (equipment_id, spare_part_id, quantity) VALUES (?, ?, ?)').run(eqIdEsp, partIds[1].id, 1);
    }
    if (partIds?.length && userId8) {
      adminDb.prepare('INSERT OR IGNORE INTO stock_movements (spare_part_id, quantity, movement_type, reference, user_id, notes) VALUES (?, ?, ?, ?, ?, ?)')
        .run(partIds[0].id, 50, 'in', 'RECEP-001', userId8, 'Réception commande');
      adminDb.prepare('INSERT OR IGNORE INTO stock_movements (spare_part_id, quantity, movement_type, work_order_id, user_id, notes) VALUES (?, ?, ?, ?, ?, ?)')
        .run(partIds[0].id, -1, 'out', woIdI || null, userId8, 'Consommation OT-2025-001');
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Commandes/interventions/stock:', e.message);
  }

  // ——— Données de test pour les nouveaux modules (Demandes d'intervention, Compteurs, IoT, SIG) ———
  try {
    const userReq = adminDb.prepare('SELECT id FROM users WHERE email = ?').get('user@xmaint.org')?.id;
    const respId = adminDb.prepare('SELECT id FROM users WHERE email = ?').get('responsable@xmaint.org')?.id;
    const eqReq1 = adminDb.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-001')?.id;
    const eqReq2 = adminDb.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-004')?.id;
    const woCreated = adminDb.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-002')?.id;

    if (userReq && eqReq1) {
      adminDb.prepare(`
        INSERT OR IGNORE INTO intervention_requests (title, description, equipment_id, requested_by, priority, status)
        VALUES ('Bruit anormal sur presse P500', 'Bruit métallique côté bloc hydraulique', ?, ?, 'high', 'pending')
      `).run(eqReq1, userReq);
      adminDb.prepare(`
        INSERT OR IGNORE INTO intervention_requests (title, description, equipment_id, requested_by, priority, status)
        VALUES ('Fuite huile pompe centrifuge', 'Gouttes sous la pompe PC-200', ?, ?, 'medium', 'pending')
      `).run(eqReq2, userReq);
    }
    const eqConv = adminDb.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-002')?.id;
    if (userReq && respId && (eqConv || eqId) && woCreated) {
      adminDb.prepare(`
        INSERT OR IGNORE INTO intervention_requests (title, description, equipment_id, requested_by, priority, status, work_order_id, validated_by, validated_at)
        VALUES ('Vibration convoyeur L1', 'Vibration au démarrage', ?, ?, 'critical', 'validated', ?, ?, datetime('now'))
      `).run(eqConv || eqId, userReq, woCreated, respId);
      adminDb.prepare(`
        INSERT OR IGNORE INTO intervention_requests (title, description, equipment_id, requested_by, priority, status, validated_by, validated_at, rejection_reason)
        VALUES ('Demande de nettoyage encoffrement', 'Nettoyage demandé sans urgence', ?, ?, 'low', 'rejected', ?, datetime('now'), 'Reporté au prochain arrêt planifié')
      `).run(eqReq1, userReq, respId);
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Demandes d\'intervention:', e.message);
  }

  try {
    const eqC1 = adminDb.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-001')?.id;
    const eqC2 = adminDb.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-004')?.id;
    if (eqC1) {
      adminDb.prepare('INSERT OR REPLACE INTO equipment_counters (equipment_id, counter_type, value, unit) VALUES (?, ?, ?, ?)').run(eqC1, 'hours', 4850, 'h');
      adminDb.prepare('INSERT OR REPLACE INTO equipment_counters (equipment_id, counter_type, value, unit) VALUES (?, ?, ?, ?)').run(eqC1, 'cycles', 125000, 'cycles');
    }
    if (eqC2) {
      adminDb.prepare('INSERT OR REPLACE INTO equipment_counters (equipment_id, counter_type, value, unit) VALUES (?, ?, ?, ?)').run(eqC2, 'hours', 3200, 'h');
      adminDb.prepare('INSERT OR REPLACE INTO equipment_counters (equipment_id, counter_type, value, unit) VALUES (?, ?, ?, ?)').run(eqC2, 'cycles', 8900, 'cycles');
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Compteurs équipement:', e.message);
  }

  try {
    const eqP1 = adminDb.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-001')?.id;
    const eqP2 = adminDb.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-004')?.id;
    if (eqP1) {
      adminDb.prepare(`
        INSERT OR IGNORE INTO maintenance_plans (equipment_id, name, description, frequency_days, next_due_date, is_active, trigger_type, counter_type, threshold_value)
        VALUES (?, 'Révision 5000 h', 'Révision complète presse (heures de marche)', 365, NULL, 1, 'counter', 'hours', 5000)
      `).run(eqP1);
      adminDb.prepare(`
        INSERT OR IGNORE INTO maintenance_plans (equipment_id, name, description, frequency_days, next_due_date, is_active, trigger_type, counter_type, threshold_value)
        VALUES (?, 'Contrôle 150 000 cycles', 'Contrôle paliers et courroies (cycles)', 365, NULL, 1, 'counter', 'cycles', 150000)
      `).run(eqP1);
    }
    if (eqP2) {
      adminDb.prepare(`
        INSERT OR IGNORE INTO maintenance_plans (equipment_id, name, description, frequency_days, next_due_date, is_active, trigger_type, counter_type, threshold_value)
        VALUES (?, 'Révision 10 000 h pompe', 'Révision pompe centrifuge (heures)', 365, NULL, 1, 'counter', 'hours', 10000)
      `).run(eqP2);
    }
  } catch (e) {
    if (!e.message?.includes('no such table') && !e.message?.includes('no such column')) console.warn('Plans conditionnels:', e.message);
  }

  try {
    const eqT1 = adminDb.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-001')?.id;
    const eqT2 = adminDb.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-004')?.id;
    if (eqT1) {
      adminDb.prepare(`
        INSERT OR IGNORE INTO equipment_thresholds (equipment_id, metric, threshold_value, operator, create_wo_on_breach)
        VALUES (?, 'hours', 5000, '>=', 0)
      `).run(eqT1);
      adminDb.prepare(`
        INSERT OR IGNORE INTO equipment_thresholds (equipment_id, metric, threshold_value, operator, create_wo_on_breach)
        VALUES (?, 'vibrations', 7.5, '>=', 0)
      `).run(eqT1);
    }
    if (eqT2) {
      adminDb.prepare(`
        INSERT OR IGNORE INTO equipment_thresholds (equipment_id, metric, threshold_value, operator, create_wo_on_breach)
        VALUES (?, 'hours', 10000, '>=', 0)
      `).run(eqT2);
      adminDb.prepare(`
        INSERT OR IGNORE INTO equipment_thresholds (equipment_id, metric, threshold_value, operator, create_wo_on_breach)
        VALUES (?, 'temperature', 85, '>=', 0)
      `).run(eqT2);
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('Seuils IoT:', e.message);
  }

  try {
    adminDb.prepare("UPDATE sites SET latitude = 48.8566, longitude = 2.3522 WHERE code = 'SITE-01'").run();
    adminDb.prepare("UPDATE sites SET latitude = 48.8606, longitude = 2.3376 WHERE code = 'SITE-02'").run();
  } catch (e) {
    if (!e.message?.includes('no such column')) console.warn('Géoloc sites:', e.message);
  }

  // ——— Étape 9 : Extensions GMAO (migration 039) ———
  try {
    adminDb.prepare("INSERT OR IGNORE INTO part_families (code, name, description) VALUES ('FAM-01', 'Joints et étanchéité', 'Joints, garnitures')").run();
    adminDb.prepare("INSERT OR IGNORE INTO part_families (code, name, description) VALUES ('FAM-02', 'Transmission', 'Courroies, roulements')").run();
    adminDb.prepare("INSERT OR IGNORE INTO part_families (code, name, description) VALUES ('FAM-03', 'Filtres', 'Filtres hydrauliques et air')").run();
    adminDb.prepare("INSERT OR IGNORE INTO brands (code, name, description) VALUES ('BR-01', 'HydraTech', 'Constructeur presses')").run();
    adminDb.prepare("INSERT OR IGNORE INTO brands (code, name, description) VALUES ('BR-02', 'ConveyorPro', 'Convoyeurs industriels')").run();
    adminDb.prepare("INSERT OR IGNORE INTO brands (code, name, description) VALUES ('BR-03', 'PumpMaster', 'Pompes et compresseurs')").run();
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('part_families/brands:', e.message);
  }
  try {
    const siteIdB = adminDb.prepare('SELECT id FROM sites WHERE code = ?').get('SITE-01')?.id;
    const projIdB = adminDb.prepare('SELECT id FROM maintenance_projects LIMIT 1').get()?.id;
    const yearB = new Date().getFullYear();
    adminDb.prepare('INSERT OR IGNORE INTO maintenance_budgets (name, site_id, project_id, year, amount, currency, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('Budget maintenance ' + yearB, siteIdB || null, projIdB || null, yearB, 85000, 'EUR', 'Budget annuel préventif et correctif');
    adminDb.prepare('INSERT OR IGNORE INTO maintenance_budgets (name, site_id, year, amount, currency) VALUES (?, ?, ?, ?, ?)')
      .run('Budget pièces détachées ' + yearB, siteIdB || null, yearB, 25000, 'EUR');
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('maintenance_budgets:', e.message);
  }
  try {
    adminDb.prepare("INSERT OR IGNORE INTO external_contractors (code, name, contact_person, email, phone) VALUES ('ST-01', 'Sous-traitance Mécanique SA', 'M. Dupont', 'contact@st-meca.fr', '01 23 45 67 00')").run();
    adminDb.prepare("INSERT OR IGNORE INTO external_contractors (code, name, contact_person, email) VALUES ('ST-02', 'Électricité Industrielle', 'Mme Martin', 'info@elec-indus.fr')").run();
    const contractorId = adminDb.prepare('SELECT id FROM external_contractors WHERE code = ?').get('ST-01')?.id;
    const woIdSub = adminDb.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-001')?.id;
    const userIdSub = adminDb.prepare('SELECT id FROM users LIMIT 1').get()?.id;
    if (contractorId && userIdSub) {
      const y = new Date().getFullYear();
      adminDb.prepare('INSERT OR IGNORE INTO subcontract_orders (number, contractor_id, work_order_id, description, status, order_date, expected_date, amount, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run('ST-' + y + '-0001', contractorId, woIdSub || null, 'Usinage pièce spéciale presse', 'sent', new Date().toISOString().slice(0, 10), new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), 1500, userIdSub);
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('external_contractors/subcontract_orders:', e.message);
  }
  try {
    adminDb.prepare("INSERT OR IGNORE INTO training_catalog (code, name, description, duration_hours, validity_months, is_mandatory) VALUES ('FORM-01', 'SST Niveau 1', 'Sauvetage secourisme du travail', 7, 24, 1)").run();
    adminDb.prepare("INSERT OR IGNORE INTO training_catalog (code, name, description, duration_hours, validity_months) VALUES ('FORM-02', 'Hydraulique industrielle', 'Bases hydraulique et dépannage', 16, 36)").run();
    adminDb.prepare("INSERT OR IGNORE INTO training_catalog (code, name, description, duration_hours) VALUES ('FORM-03', 'Électricité sécurité', 'Risques électriques et consignation', 8, null)").run();
    const catalogId = adminDb.prepare('SELECT id FROM training_catalog WHERE code = ?').get('FORM-01')?.id;
    const techIdTrain = adminDb.prepare('SELECT id FROM users WHERE email = ?').get('technicien@xmaint.org')?.id;
    if (catalogId && techIdTrain) {
      const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      adminDb.prepare('INSERT OR IGNORE INTO training_plans (technician_id, training_catalog_id, planned_date, completed_date, status, notes) VALUES (?, ?, ?, NULL, ?, NULL)')
        .run(techIdTrain, catalogId, nextMonth, null, 'planned', null);
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('training_catalog/training_plans:', e.message);
  }
  try {
    const woIdSat = adminDb.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-001')?.id;
    if (woIdSat) {
      adminDb.prepare('INSERT OR IGNORE INTO satisfaction_surveys (work_order_id, rating, comment) VALUES (?, ?, ?)')
        .run(woIdSat, 4, 'Intervention rapide et efficace.');
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('satisfaction_surveys:', e.message);
  }
  try {
    const woIdRc = adminDb.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-001')?.id;
    const eqIdRc = adminDb.prepare('SELECT id FROM equipment WHERE code = ?').get('EQ-001')?.id;
    const userIdRc = adminDb.prepare('SELECT id FROM users LIMIT 1').get()?.id;
    if (woIdRc && userIdRc) {
      adminDb.prepare('INSERT OR IGNORE INTO equipment_root_causes (work_order_id, equipment_id, root_cause_code, root_cause_description, analysis_method, created_by) VALUES (?, ?, ?, ?, ?, ?)')
        .run(woIdRc, eqIdRc || null, 'USURE', 'Usure joint après 5000 h', '5M', userIdRc);
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('equipment_root_causes:', e.message);
  }
  try {
    const typeIdTmpl = adminDb.prepare('SELECT id FROM work_order_types WHERE name = ?').get('Correctif')?.id;
    adminDb.prepare('INSERT OR IGNORE INTO work_order_templates (name, description, type_id, default_priority, estimated_hours) VALUES (?, ?, ?, ?, ?)')
      .run('Correctif standard', 'OT correctif générique', typeIdTmpl || null, 'medium', 2);
    adminDb.prepare('INSERT OR IGNORE INTO work_order_templates (name, description, type_id, default_priority, estimated_hours) VALUES (?, ?, ?, ?, ?)')
      .run('Inspection mensuelle', 'Tour de contrôle équipement', adminDb.prepare('SELECT id FROM work_order_types WHERE name = ?').get('Inspection')?.id || null, 'low', 0.5);
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('work_order_templates:', e.message);
  }
  try {
    const siteIdLoc = adminDb.prepare('SELECT id FROM sites WHERE code = ?').get('SITE-01')?.id;
    adminDb.prepare('INSERT OR IGNORE INTO stock_locations (code, name, description, site_id) VALUES (?, ?, ?, ?)')
      .run('EMP-A1', 'Étagère A - Zone atelier', 'Zone pièces courantes', siteIdLoc || null);
    adminDb.prepare('INSERT OR IGNORE INTO stock_locations (code, name, description) VALUES (?, ?, ?)')
      .run('EMP-B1', 'Réserve centrale', 'Stock sécurité');
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('stock_locations:', e.message);
  }
  try {
    const partIdRes = adminDb.prepare('SELECT id FROM spare_parts LIMIT 1').get()?.id;
    const woIdRes = adminDb.prepare('SELECT id FROM work_orders WHERE number = ?').get('OT-2025-002')?.id;
    const userIdRes = adminDb.prepare('SELECT id FROM users LIMIT 1').get()?.id;
    if (partIdRes && woIdRes && userIdRes) {
      adminDb.prepare('INSERT OR IGNORE INTO stock_reservations (spare_part_id, work_order_id, quantity, status, reserved_by) VALUES (?, ?, ?, ?, ?)')
        .run(partIdRes, woIdRes, 2, 'reserved', userIdRes);
    }
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('stock_reservations:', e.message);
  }
  try {
    adminDb.prepare("INSERT OR IGNORE INTO email_templates (code, name, subject_template, body_template, description) VALUES ('wo_assigned', 'OT affecté', 'OT {{wo_number}} vous a été affecté', 'Bonjour,\n\nL''ordre de travail {{wo_number}} vous a été affecté.\n\nCordialement', 'Notification affectation OT')").run();
    adminDb.prepare("INSERT OR IGNORE INTO email_templates (code, name, subject_template, body_template) VALUES ('wo_completed', 'OT clôturé', 'OT {{wo_number}} clôturé', 'L''ordre de travail {{wo_number}} a été clôturé.')").run();
  } catch (e) {
    if (!e.message?.includes('no such table')) console.warn('email_templates:', e.message);
  }

  console.log('✅ Données de démo créées');
  console.log('\nDonnées de test pour les nouveaux modules :');
  console.log('  - Projets de maintenance (3 projets, OT-2025-001 et OT-2025-002 rattachés au 1er)');
  console.log('  - Demandes d\'intervention (pending / validées / rejetées)');
  console.log('  - Compteurs équipement (heures, cycles) sur EQ-001 et EQ-004');
  console.log('  - Plans de maintenance conditionnelle (seuils heures/cycles)');
  console.log('  - Seuils IoT sur EQ-001 et EQ-004');
  console.log('  - Sites SITE-01 et SITE-02 avec coordonnées (carte SIG)');
  console.log('  - Extensions GMAO : familles de pièces, marques, budgets maintenance, sous-traitants, ordres ST, catalogue formation, plans formation, satisfaction, causes racines, modèles OT, emplacements stock, réservations stock, templates email');
  console.log('\nComptes de test (mot de passe: Password123!)');
  console.log('  - admin@xmaint.org (Administrateur)');
  console.log('  - responsable@xmaint.org (Responsable maintenance)');
  console.log('  - technicien@xmaint.org (Technicien)');
  console.log('  - user@xmaint.org (Utilisateur)');

  db.close();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
