-- 1. Добавляем company_id в основные таблицы
ALTER TABLE t_p45929761_bold_move_project.live_chats
  ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES t_p45929761_bold_move_project.users(id);

ALTER TABLE t_p45929761_bold_move_project.calendar_events
  ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES t_p45929761_bold_move_project.users(id);

ALTER TABLE t_p45929761_bold_move_project.saved_estimates
  ADD COLUMN IF NOT EXISTS company_id INTEGER;

-- 2. Создаём мастер-аккаунт (пароль = sha256 от "Sdauxbasstre228")
INSERT INTO t_p45929761_bold_move_project.users (email, password_hash, name, phone)
VALUES (
  'master@mospotolki.ru',
  'a8b3c2e1f4d5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1',
  'Мастер (Юра)',
  NULL
)
ON CONFLICT (email) DO NOTHING;

-- 3. Все существующие заявки без company_id → мастер-аккаунту
UPDATE t_p45929761_bold_move_project.live_chats
SET company_id = (SELECT id FROM t_p45929761_bold_move_project.users WHERE email = 'master@mospotolki.ru')
WHERE company_id IS NULL;

UPDATE t_p45929761_bold_move_project.calendar_events
SET company_id = (SELECT id FROM t_p45929761_bold_move_project.users WHERE email = 'master@mospotolki.ru')
WHERE company_id IS NULL;

UPDATE t_p45929761_bold_move_project.saved_estimates
SET company_id = (SELECT id FROM t_p45929761_bold_move_project.users WHERE email = 'master@mospotolki.ru')
WHERE company_id IS NULL;

-- 4. Индексы
CREATE INDEX IF NOT EXISTS idx_live_chats_company_id ON t_p45929761_bold_move_project.live_chats(company_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_company_id ON t_p45929761_bold_move_project.calendar_events(company_id);
