-- Линии (аккаунты мессенджеров) компании — несколько Telegram/MAX номеров на компанию
CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.messenger_accounts (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  channel VARCHAR(20) NOT NULL,              -- 'telegram' | 'max'
  title VARCHAR(120) NOT NULL,               -- «Линия 1 · Max»
  external_id VARCHAR(120) NOT NULL,         -- ID сессии на VPS (уникален в рамках компании)
  phone VARCHAR(20),                         -- номер телефона (обязателен для Max)
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  auth_status VARCHAR(20) NOT NULL DEFAULT 'none',
  -- none | requested | connecting | qr_ready | code_requested | code_submitted |
  -- password_requested | password_submitted | authorized | error
  auth_payload TEXT,                         -- QR-картинка base64 (Telegram) или подсказка/ошибка текстом
  auth_value TEXT,                           -- введённый код/пароль, авто-очищается после использования
  auth_updated_at TIMESTAMP,
  account_name VARCHAR(255),                 -- имя/телефон, которое подтвердил мессенджер после входа
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_messenger_accounts_company
  ON t_p45929761_bold_move_project.messenger_accounts (company_id);

-- Привязка входящих/исходящих сообщений к конкретной линии (какой аккаунт переписывался)
ALTER TABLE t_p45929761_bold_move_project.touch_events
  ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES t_p45929761_bold_move_project.messenger_accounts(id);
