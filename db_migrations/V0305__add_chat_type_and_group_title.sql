-- Различаем личные диалоги и групповые чаты Telegram/MAX. По умолчанию все
-- существующие клиенты — личные (chat_type='private'). group_title — название
-- группы (для отображения в CRM вместо имени случайного первого написавшего).
ALTER TABLE t_p45929761_bold_move_project.touch_clients
  ADD COLUMN IF NOT EXISTS chat_type VARCHAR(16) NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS group_title VARCHAR(255);

-- Имя автора конкретного сообщения — нужно в ленте группового чата, чтобы
-- отличать, кто из участников что написал (в личных диалогах не используется).
ALTER TABLE t_p45929761_bold_move_project.touch_events
  ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255);

-- Разово помечаем уже накопившиеся telegram-записи с отрицательным chat_id
-- (это единственный признак группы в уже сохранённых данных, до правки воркера,
-- который начнёт присылать точный тип чата явно) — их сейчас 20+ штук, они
-- выглядят как обычные "клиенты", хотя на самом деле это Telegram-группы.
UPDATE t_p45929761_bold_move_project.touch_clients
SET chat_type = 'group',
    group_title = COALESCE(name, 'Группа Telegram')
WHERE (channel_ids->>'telegram') ~ '^-\d+$';
