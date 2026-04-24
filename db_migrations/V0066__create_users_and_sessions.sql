CREATE TABLE t_p45929761_bold_move_project.users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT,
  phone         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE t_p45929761_bold_move_project.user_sessions (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES t_p45929761_bold_move_project.users(id),
  token      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

CREATE INDEX idx_user_sessions_token   ON t_p45929761_bold_move_project.user_sessions(token);
CREATE INDEX idx_user_sessions_user_id ON t_p45929761_bold_move_project.user_sessions(user_id);
