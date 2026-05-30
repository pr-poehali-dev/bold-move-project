ALTER TABLE t_p45929761_bold_move_project.users
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_expires_at timestamp with time zone NULL;

CREATE INDEX IF NOT EXISTS idx_users_is_demo ON t_p45929761_bold_move_project.users(is_demo) WHERE is_demo = true;
