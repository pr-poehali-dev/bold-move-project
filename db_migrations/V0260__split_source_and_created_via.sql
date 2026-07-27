-- Добавляем поле "Создано через" — технический канал создания заявки (Чат/Построитель/CRM)
ALTER TABLE t_p45929761_bold_move_project.live_chats
  ADD COLUMN IF NOT EXISTS created_via TEXT NULL DEFAULT 'chat';

-- Переносим существующие технические значения из source в created_via
UPDATE t_p45929761_bold_move_project.live_chats
SET created_via = CASE
  WHEN source = 'plan' THEN 'plan'
  WHEN source = 'manual' THEN 'manual'
  ELSE 'chat'
END
WHERE source IN ('chat', 'plan', 'manual') OR source IS NULL;

-- Очищаем поле source от технического мусора — теперь оно только для маркетинговых источников (Авито, ВК и т.д.)
UPDATE t_p45929761_bold_move_project.live_chats
SET source = NULL
WHERE source IN ('chat', 'plan', 'manual');

-- Меняем дефолт source — новые заявки больше не должны получать техническое значение
ALTER TABLE t_p45929761_bold_move_project.live_chats
  ALTER COLUMN source SET DEFAULT NULL;