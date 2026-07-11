ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
