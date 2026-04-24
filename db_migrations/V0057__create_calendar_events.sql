CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.calendar_events (
  id serial PRIMARY KEY,
  client_id integer NULL REFERENCES t_p45929761_bold_move_project.live_chats(id),
  title text NOT NULL,
  description text NULL,
  event_type text NOT NULL DEFAULT 'measure',
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NULL,
  color text NOT NULL DEFAULT '#7c3aed',
  created_at timestamp with time zone DEFAULT now()
)
