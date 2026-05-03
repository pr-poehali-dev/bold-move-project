-- Таблица кастомных клиентских статусов (на компанию)
CREATE TABLE client_statuses (
  id         SERIAL PRIMARY KEY,
  company_id INTEGER      NOT NULL,
  name       VARCHAR(64)  NOT NULL,
  color      VARCHAR(16)  NOT NULL DEFAULT '#7c3aed',
  sort_order INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT client_statuses_company_name_unique UNIQUE (company_id, name)
);

-- Дефолтные статусы для компании id=2 (мастер/тест)
INSERT INTO client_statuses (company_id, name, color, sort_order) VALUES
  (2, 'Новый',      '#6366f1', 0),
  (2, 'Активный',   '#10b981', 1),
  (2, 'VIP',        '#f59e0b', 2),
  (2, 'Холодный',   '#64748b', 3),
  (2, 'Отказник',   '#ef4444', 4);

-- Добавляем поле client_status в live_chats
ALTER TABLE live_chats ADD COLUMN client_status VARCHAR(64) NULL;
