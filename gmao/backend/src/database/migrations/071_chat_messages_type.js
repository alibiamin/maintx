/**
 * Migration 071 - Type de message chat (user | system) pour les notifications OT.
 */

function up(db) {
  try {
    db.prepare('SELECT 1 FROM chat_messages LIMIT 1').get();
  } catch (e) {
    if (e.message && e.message.includes('no such table')) return;
    throw e;
  }
  try {
    db.prepare('ALTER TABLE chat_messages ADD COLUMN message_type TEXT DEFAULT \'user\'').run();
  } catch (e) {
    if (!e.message || (!e.message.includes('duplicate column') && !e.message.includes('already exists'))) throw e;
  }
}

module.exports = { up };
