/**
 * Migration 009 - Notifications email/SMS : phone sur users + préférences
 */
function up(db) {
  try {
    db.exec(`ALTER TABLE users ADD COLUMN phone TEXT`);
  } catch (e) {
    if (!e.message || !e.message.includes('duplicate column')) throw e;
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
      enabled INTEGER DEFAULT 1,
      UNIQUE(user_id, event_type, channel)
    );
    CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON notification_preferences(user_id);
  `);
  const events = ['work_order_created', 'work_order_assigned', 'work_order_closed', 'plan_overdue', 'stock_alert'];
  const users = db.prepare(`
    SELECT u.id FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE r.name IN ('responsable_maintenance', 'administrateur') AND u.is_active = 1
  `).all();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO notification_preferences (user_id, event_type, channel, enabled) VALUES (?, ?, ?, ?)
  `);
  users.forEach((u) => {
    events.forEach((ev) => {
      insert.run(u.id, ev, 'email', 1);
      insert.run(u.id, ev, 'sms', 0);
    });
  });
}

module.exports = { up };
