/**
 * Script de peuplement initial - Données de démo et utilisateurs
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'xmaint.db');

async function seed() {
  if (!fs.existsSync(dbPath)) {
    console.error('❌ Base de données non trouvée. Exécutez: npm run init-db');
    process.exit(1);
  }

  const db = require('./db');
  await db.init();

  console.log('🌱 Peuplement de la base de données...');

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
    { email: 'user@xmaint.org', firstName: 'Marie', lastName: 'Utilisatrice', role: 'utilisateur' }
  ];

  for (const u of users) {
    db.prepare('INSERT OR IGNORE INTO users (email, password_hash, first_name, last_name, role_id) VALUES (?, ?, ?, ?, ?)')
      .run(u.email, passwordHash, u.firstName, u.lastName, roleIds[u.role]);
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

  console.log('✅ Données de démo créées');
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
