-- Drop old chore tables
DROP TABLE IF EXISTS chore_completions;
DROP TABLE IF EXISTS chore_assignments;
DROP TABLE IF EXISTS chores;

-- Create new tables
CREATE TABLE people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#888888',
    avatar BLOB
);

CREATE TABLE chores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    chore_type TEXT NOT NULL DEFAULT 'regular' CHECK (chore_type IN ('regular', 'meta')),
    tags TEXT NOT NULL DEFAULT '[]',
    pick_from_tags TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chore_id INTEGER NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    week_of TEXT NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    picked_chore_id INTEGER REFERENCES chores(id) ON DELETE SET NULL,
    completed INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_assignments_week ON assignments(week_of);
CREATE INDEX idx_assignments_person ON assignments(person_id);
