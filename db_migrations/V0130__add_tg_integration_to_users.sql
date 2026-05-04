ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tg_bot_token    TEXT,
  ADD COLUMN IF NOT EXISTS tg_notify_chat_id TEXT;