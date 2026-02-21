/**
 * Migration 013 - Infos personnelles et techniques (utilisateurs / techniciens)
 */
function up(db) {
  const columns = [
    { name: 'address', sql: 'ALTER TABLE users ADD COLUMN address TEXT' },
    { name: 'city', sql: 'ALTER TABLE users ADD COLUMN city TEXT' },
    { name: 'postal_code', sql: 'ALTER TABLE users ADD COLUMN postal_code TEXT' },
    { name: 'employee_number', sql: 'ALTER TABLE users ADD COLUMN employee_number TEXT' },
    { name: 'job_title', sql: 'ALTER TABLE users ADD COLUMN job_title TEXT' },
    { name: 'department', sql: 'ALTER TABLE users ADD COLUMN department TEXT' },
    { name: 'hire_date', sql: 'ALTER TABLE users ADD COLUMN hire_date TEXT' },
    { name: 'contract_type', sql: 'ALTER TABLE users ADD COLUMN contract_type TEXT' }
  ];
  columns.forEach(({ sql }) => {
    try {
      db.exec(sql);
    } catch (e) {
      if (!e.message || !e.message.includes('duplicate column')) throw e;
    }
  });
}

module.exports = { up };
