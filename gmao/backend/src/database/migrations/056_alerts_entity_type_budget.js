/**
 * Migration 056 (base client) - Étend alerts pour entity_type 'budget' (alertes dépassement budget)
 * SQLite ne permet pas d'ALTER CHECK : on recrée la table si elle existe.
 */
function up(db) {
  try {
    db.prepare('SELECT 1 FROM alerts LIMIT 1').get();
  } catch (e) {
    if (e.message && e.message.includes('no such table')) {
      db.exec(`
        CREATE TABLE alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          alert_type TEXT NOT NULL,
          severity TEXT DEFAULT 'info',
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          entity_type TEXT,
          entity_id INTEGER,
          is_read INTEGER DEFAULT 0,
          read_at DATETIME,
          read_by INTEGER,
          target_user_id INTEGER,
          expires_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_alerts_entity ON alerts(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(is_read);
      `);
      return;
    }
    throw e;
  }
  try {
    db.exec(`
      CREATE TABLE alerts_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_type TEXT NOT NULL,
        severity TEXT DEFAULT 'info',
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        is_read INTEGER DEFAULT 0,
        read_at DATETIME,
        read_by INTEGER,
        target_user_id INTEGER,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO alerts_new SELECT id, alert_type, severity, title, message, entity_type, entity_id, is_read, read_at, read_by, target_user_id, expires_at, created_at FROM alerts;
      DROP TABLE alerts;
      ALTER TABLE alerts_new RENAME TO alerts;
      CREATE INDEX IF NOT EXISTS idx_alerts_entity ON alerts(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(is_read);
    `);
  } catch (e) {
    if (!e.message || (!e.message.includes('duplicate') && !e.message.includes('already exists'))) {
      console.warn('[DB] Migration 056 alerts:', e.message);
    }
  }
}

module.exports = { up };
