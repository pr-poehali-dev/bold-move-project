CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.kanban_cards (
  id serial PRIMARY KEY,
  column_id integer NOT NULL REFERENCES t_p45929761_bold_move_project.kanban_columns(id),
  client_id integer NULL REFERENCES t_p45929761_bold_move_project.live_chats(id),
  title text NOT NULL,
  description text NULL,
  phone text NULL,
  amount numeric(12,2) NULL,
  priority text NOT NULL DEFAULT 'medium',
  position integer NOT NULL DEFAULT 0,
  due_date timestamp with time zone NULL,
  created_at timestamp with time zone DEFAULT now()
)
