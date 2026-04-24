CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.kanban_columns (
  id serial PRIMARY KEY,
  title text NOT NULL,
  color text NOT NULL DEFAULT '#7c3aed',
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
)
