/**
 * Migration 006 - Techniciens : compétences, évaluations, liaison type d'OT ↔ compétence
 */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS competencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_competencies_code ON competencies(code);

    CREATE TABLE IF NOT EXISTS technician_competencies (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      competence_id INTEGER NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
      level INTEGER NOT NULL DEFAULT 1 CHECK(level >= 1 AND level <= 5),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, competence_id)
    );
    CREATE INDEX IF NOT EXISTS idx_technician_competencies_user ON technician_competencies(user_id);
    CREATE INDEX IF NOT EXISTS idx_technician_competencies_competence ON technician_competencies(competence_id);

    CREATE TABLE IF NOT EXISTS type_competencies (
      work_order_type_id INTEGER NOT NULL REFERENCES work_order_types(id) ON DELETE CASCADE,
      competence_id INTEGER NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
      required_level INTEGER NOT NULL DEFAULT 1 CHECK(required_level >= 1 AND required_level <= 5),
      PRIMARY KEY (work_order_type_id, competence_id)
    );
    CREATE INDEX IF NOT EXISTS idx_type_competencies_type ON type_competencies(work_order_type_id);

    CREATE TABLE IF NOT EXISTS technician_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      technician_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      evaluator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      work_order_id INTEGER REFERENCES work_orders(id) ON DELETE SET NULL,
      score INTEGER NOT NULL CHECK(score >= 1 AND score <= 5),
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_technician_evaluations_technician ON technician_evaluations(technician_id);
    CREATE INDEX IF NOT EXISTS idx_technician_evaluations_evaluator ON technician_evaluations(evaluator_id);
  `);
}

module.exports = { up };
