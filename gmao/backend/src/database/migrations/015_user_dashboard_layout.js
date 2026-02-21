module.exports = {
  up(db) {
    try {
      db.exec('ALTER TABLE users ADD COLUMN dashboard_layout TEXT');
    } catch (e) {
      if (!e.message.includes('duplicate column')) throw e;
    }
  }
};
