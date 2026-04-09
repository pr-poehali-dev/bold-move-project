CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.live_chats (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  client_name TEXT,
  telegram_message_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.live_messages (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('client', 'operator')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_messages_session ON t_p45929761_bold_move_project.live_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_live_chats_session ON t_p45929761_bold_move_project.live_chats(session_id);
