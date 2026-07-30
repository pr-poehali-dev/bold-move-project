-- Пометки диалогов в разделе "Сообщения": закреплён / избранное / скрыт.
-- Безопасно: только добавляем новые колонки с дефолтом FALSE, ничего не удаляем.
ALTER TABLE t_p45929761_bold_move_project.touch_clients
  ADD COLUMN IF NOT EXISTS pinned   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hidden   BOOLEAN NOT NULL DEFAULT FALSE;