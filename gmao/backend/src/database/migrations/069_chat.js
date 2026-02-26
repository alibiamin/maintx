/**
 * Migration 069 - Chat d'équipe (base client)
 * Tables: chat_channels (canaux généraux ou liés OT/équipement), chat_channel_members, chat_messages.
 */

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'team',
      linked_type TEXT,
      linked_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_chat_channels_type ON chat_channels(type);
    CREATE INDEX IF NOT EXISTS idx_chat_channels_linked ON chat_channels(linked_type, linked_id);

    CREATE TABLE IF NOT EXISTS chat_channel_members (
      channel_id INTEGER NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (channel_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_chat_members_channel ON chat_channel_members(channel_id);

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
  `);
}

module.exports = { up };
