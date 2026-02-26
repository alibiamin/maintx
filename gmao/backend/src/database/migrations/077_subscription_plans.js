/**
 * Migration 077 - Offres d'abonnement (base admin MAINTX uniquement)
 * Prix paramétrables depuis le menu client/tenant. Utilisés sur la landing.
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      price REAL,
      period TEXT DEFAULT 'month',
      display_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_code ON subscription_plans(code);
  `);
  const existing = db.prepare('SELECT 1 FROM subscription_plans WHERE code = ?').get('starter');
  if (!existing) {
    db.prepare(`
      INSERT INTO subscription_plans (code, name, price, period, display_order)
      VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)
    `).run('starter', 'Starter', 49, 'month', 1, 'pro', 'Pro', 99, 'month', 2, 'enterprise', 'Enterprise', null, 'month', 3);
  }
}

module.exports = { up };
