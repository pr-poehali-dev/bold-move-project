ALTER TABLE t_p45929761_bold_move_project.user_sessions
ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'user';