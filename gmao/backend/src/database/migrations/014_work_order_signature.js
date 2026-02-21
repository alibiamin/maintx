module.exports = {
  up(db) {
    try {
      db.exec('ALTER TABLE work_orders ADD COLUMN completed_by INTEGER REFERENCES users(id)');
    } catch (e) {
      if (!e.message.includes('duplicate column')) throw e;
    }
    try {
      db.exec('ALTER TABLE work_orders ADD COLUMN completed_at DATETIME');
    } catch (e) {
      if (!e.message.includes('duplicate column')) throw e;
    }
    try {
      db.exec('ALTER TABLE work_orders ADD COLUMN signature_name TEXT');
    } catch (e) {
      if (!e.message.includes('duplicate column')) throw e;
    }
  }
};
