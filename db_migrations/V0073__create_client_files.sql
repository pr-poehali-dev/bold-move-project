CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.client_files (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'image',
  created_at TIMESTAMP DEFAULT NOW()
);