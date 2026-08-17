-- Журнал ВСЕХ входящих заявок (Telegram-заявки, leakad-вебхук, email-заявки).
-- Пишется СРАЗУ при получении запроса, ДО попытки создать карточку в live_chats.
-- Нужен для расследования потерь: если карточка не создалась (сбой БД, таймаут
-- функции, ошибка парсинга) — сырой текст заявки всё равно сохранён и её можно
-- восстановить вручную. Для Авито такой журнал уже есть (avito_webhook_raw_log).
CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.leads_webhook_raw_log (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NULL,
    -- Откуда пришло: 'telegram_leads' | 'leakad_webhook' | 'email_leads'
    channel VARCHAR(64) NOT NULL,
    -- Сырое тело запроса как пришло (для восстановления заявки руками)
    payload JSONB NOT NULL,
    -- Телефон, если удалось распарсить — чтобы быстро искать потерянные заявки
    parsed_phone VARCHAR(32) NULL,
    -- Чем закончилась обработка: 'created' | 'duplicate' | 'skipped' | 'error'
    outcome VARCHAR(32) NULL,
    -- id созданной карточки, если создана
    client_id INTEGER NULL,
    error TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_webhook_raw_log_created_at
    ON t_p45929761_bold_move_project.leads_webhook_raw_log (created_at DESC);

-- Быстрый поиск «что пришло, но не создалось»
CREATE INDEX IF NOT EXISTS idx_leads_webhook_raw_log_outcome
    ON t_p45929761_bold_move_project.leads_webhook_raw_log (outcome, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_webhook_raw_log_phone
    ON t_p45929761_bold_move_project.leads_webhook_raw_log (parsed_phone);
