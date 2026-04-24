-- Сохранённые сметы клиентов
-- Хранит снимок сметы на момент сохранения (цены не меняются)
CREATE TABLE t_p45929761_bold_move_project.saved_estimates (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES t_p45929761_bold_move_project.users(id),
  chat_id       INTEGER REFERENCES t_p45929761_bold_move_project.live_chats(id),
  title         TEXT NOT NULL DEFAULT 'Смета на натяжные потолки',
  -- Снимок данных сметы в JSON
  blocks        JSONB NOT NULL DEFAULT '[]',
  totals        JSONB NOT NULL DEFAULT '[]',
  final_phrase  TEXT,
  -- Итоговые суммы (для быстрого доступа)
  total_econom    NUMERIC(12,2),
  total_standard  NUMERIC(12,2),
  total_premium   NUMERIC(12,2),
  -- Статус
  status        TEXT NOT NULL DEFAULT 'new',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saved_estimates_user_id ON t_p45929761_bold_move_project.saved_estimates(user_id);
CREATE INDEX idx_saved_estimates_chat_id ON t_p45929761_bold_move_project.saved_estimates(chat_id);
