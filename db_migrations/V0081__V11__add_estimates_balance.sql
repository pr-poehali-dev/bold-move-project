ALTER TABLE t_p45929761_bold_move_project.users
  ADD COLUMN IF NOT EXISTS estimates_balance INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.balance_transactions (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES t_p45929761_bold_move_project.users(id),
  amount       INTEGER NOT NULL,
  reason       TEXT NOT NULL,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);