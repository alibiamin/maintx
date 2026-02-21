/**
 * Script d'initialisation de la base de données SQLite
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const schema = `
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
CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS lignes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS equipment_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES equipment_categories(id),
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category_id INTEGER REFERENCES equipment_categories(id),
  ligne_id INTEGER REFERENCES lignes(id),
  parent_id INTEGER REFERENCES equipment(id),
  serial_number TEXT,
  criticite TEXT DEFAULT 'B' CHECK(criticite IN ('A','B','C')),
  manufacturer TEXT,
  model TEXT,
  installation_date DATE,
  location TEXT,
  technical_specs TEXT,
  status TEXT DEFAULT 'operational' CHECK(status IN ('operational', 'maintenance', 'out_of_service', 'retired')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS spare_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT DEFAULT 'unit',
  unit_price REAL DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  supplier_id INTEGER REFERENCES suppliers(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  spare_part_id INTEGER NOT NULL REFERENCES spare_parts(id),
  quantity INTEGER NOT NULL,
  movement_type TEXT NOT NULL CHECK(movement_type IN ('in', 'out', 'adjustment', 'transfer')),
  reference TEXT,
  work_order_id INTEGER,
  user_id INTEGER REFERENCES users(id),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS stock_balance (
  spare_part_id INTEGER PRIMARY KEY REFERENCES spare_parts(id),
  quantity INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS maintenance_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id),
  name TEXT NOT NULL,
  description TEXT,
  frequency_days INTEGER NOT NULL,
  last_execution_date DATE,
  next_due_date DATE,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS work_order_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  color TEXT
);
CREATE TABLE IF NOT EXISTS work_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  equipment_id INTEGER REFERENCES equipment(id),
  type_id INTEGER REFERENCES work_order_types(id),
  priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled', 'deferred')),
  assigned_to INTEGER REFERENCES users(id),
  planned_start DATETIME,
  planned_end DATETIME,
  actual_start DATETIME,
  actual_end DATETIME,
  maintenance_plan_id INTEGER REFERENCES maintenance_plans(id),
  failure_date DATETIME,
  created_by INTEGER REFERENCES users(id),
  declared_by INTEGER REFERENCES users(id),
  validated_by INTEGER REFERENCES users(id),
  sla_deadline DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS interventions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
  description TEXT,
  hours_spent REAL DEFAULT 0,
  spare_part_id INTEGER REFERENCES spare_parts(id),
  quantity_used INTEGER DEFAULT 0,
  technician_id INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS supplier_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'sent', 'confirmed', 'received', 'cancelled')),
  order_date DATE,
  expected_date DATE,
  received_date DATE,
  total_amount REAL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS supplier_order_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES supplier_orders(id),
  spare_part_id INTEGER REFERENCES spare_parts(id),
  description TEXT,
  quantity INTEGER NOT NULL,
  unit_price REAL DEFAULT 0,
  received_quantity INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS equipment_spare_parts (
  equipment_id INTEGER REFERENCES equipment(id),
  spare_part_id INTEGER REFERENCES spare_parts(id),
  quantity INTEGER DEFAULT 1,
  PRIMARY KEY (equipment_id, spare_part_id)
);
CREATE INDEX IF NOT EXISTS idx_lignes_site ON lignes(site_id);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category_id);
CREATE INDEX IF NOT EXISTS idx_equipment_ligne ON equipment(ligne_id);
CREATE INDEX IF NOT EXISTS idx_equipment_parent ON equipment(parent_id);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_equipment ON work_orders(equipment_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned ON work_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_stock_movements_part ON stock_movements(spare_part_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_plans_equipment ON maintenance_plans(equipment_id);
`;

async function run() {
  const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'xmaint.db');
  const db = require('./db');
  await db.init();
  db.exec(schema);
  db._save();
  console.log('✅ Base de données xmaint initialisée avec succès');
  console.log('   Fichier:', dbPath);
  db.close();
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
