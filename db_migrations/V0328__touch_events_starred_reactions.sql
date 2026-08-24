-- Отметки и реакции на уровне отдельного сообщения (раньше были только у диалога).
-- starred  — «отмеченное» сообщение (long-press в мессенджере / звёздочка в CRM).
-- reactions — список реакций: [{"emoji":"👍","author":"Иван","by":"in|out"}].
-- Оба поля необязательные: старые сообщения продолжают работать без изменений.
ALTER TABLE t_p45929761_bold_move_project.touch_events
  ADD COLUMN IF NOT EXISTS starred BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reactions JSONB;

-- Быстрый поиск отмеченных сообщений внутри диалога
CREATE INDEX IF NOT EXISTS idx_touch_events_starred
  ON t_p45929761_bold_move_project.touch_events (client_id)
  WHERE starred = TRUE;