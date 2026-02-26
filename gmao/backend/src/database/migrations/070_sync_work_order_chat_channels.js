/**
 * Migration 070 - Créer les canaux de chat pour les OT existants (créés avant la mise en place du chat).
 * Pour chaque work_order sans canal lié, crée un canal nommé comme l'OT avec les membres : created_by, assigned_to, work_order_operators.
 */

function up(db) {
  try {
    // Vérifier que les tables chat existent (migration 069)
    db.prepare('SELECT 1 FROM chat_channels LIMIT 1').get();
  } catch (e) {
    if (e.message && e.message.includes('no such table')) {
      console.log('Migration 070 : tables chat absentes, skip sync canaux OT');
      return;
    }
    throw e;
  }

  const workOrders = db.prepare(`
    SELECT id, number, created_by, assigned_to FROM work_orders
  `).all();

  const hasChannel = db.prepare(`
    SELECT id FROM chat_channels WHERE linked_type = 'work_order' AND linked_id = ?
  `);
  const insertChannel = db.prepare(`
    INSERT INTO chat_channels (name, type, linked_type, linked_id, created_by)
    VALUES (?, 'work_order', 'work_order', ?, ?)
  `);
  const insertMember = db.prepare(`
    INSERT OR IGNORE INTO chat_channel_members (channel_id, user_id) VALUES (?, ?)
  `);
  const getOperators = db.prepare(`
    SELECT user_id FROM work_order_operators WHERE work_order_id = ?
  `);

  let created = 0;
  for (const wo of workOrders) {
    const existing = hasChannel.get(wo.id);
    if (existing) continue;

    const run = insertChannel.run(
      wo.number || `OT ${wo.id}`,
      wo.id,
      wo.created_by || null
    );
    const channelId = run.lastInsertRowid;

    const operatorRows = getOperators.all(wo.id) || [];
    const memberIds = [
      wo.created_by,
      wo.assigned_to,
      ...operatorRows.map((r) => r.user_id)
    ].filter(Boolean);
    const uniqueIds = [...new Set(memberIds)];

    for (const uid of uniqueIds) {
      insertMember.run(channelId, uid);
    }
    created++;
  }

  if (created > 0) {
    console.log(`Migration 070 : ${created} canal/canaux de chat créé(s) pour les OT existants`);
  }
}

module.exports = { up };
