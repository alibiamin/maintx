/**
 * Migration 016 - Demandes d'intervention (portail Open) + log escalade SLA (Flow)
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS intervention_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      equipment_id INTEGER REFERENCES equipment(id),
      requested_by INTEGER NOT NULL REFERENCES users(id),
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'validated', 'rejected')),
      work_order_id INTEGER REFERENCES work_orders(id),
      validated_by INTEGER REFERENCES users(id),
      validated_at DATETIME,
      rejection_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_intervention_requests_status ON intervention_requests(status);
    CREATE INDEX IF NOT EXISTS idx_intervention_requests_requested_by ON intervention_requests(requested_by);

    CREATE TABLE IF NOT EXISTS sla_escalation_log (
      work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
      escalated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (work_order_id)
    );
  `);
  const events = ['sla_breached'];
  try {
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
  } catch (e) {
    if (!e.message || !e.message.includes('no such table')) throw e;
  }
}

module.exports = { up };
