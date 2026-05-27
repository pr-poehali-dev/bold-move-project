ALTER TABLE t_p45929761_bold_move_project.users
  ADD COLUMN IF NOT EXISTS max_bot_token     text NULL,
  ADD COLUMN IF NOT EXISTS max_notify_chat_id text NULL;