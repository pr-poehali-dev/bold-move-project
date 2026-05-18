CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.plan_shares (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  company_id INTEGER,
  chat_id INTEGER,
  room_ids INTEGER[] NOT NULL DEFAULT '{}',
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_plan_shares_token ON t_p45929761_bold_move_project.plan_shares(token);
CREATE INDEX IF NOT EXISTS idx_plan_shares_chat_id ON t_p45929761_bold_move_project.plan_shares(chat_id);
