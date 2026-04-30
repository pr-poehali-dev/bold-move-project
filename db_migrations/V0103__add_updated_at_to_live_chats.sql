ALTER TABLE t_p45929761_bold_move_project.live_chats
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE t_p45929761_bold_move_project.live_chats
SET updated_at = COALESCE(last_message_at, created_at);
