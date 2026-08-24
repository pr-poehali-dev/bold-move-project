-- Групповые чаты MAX ошибочно сохранены как личные диалоги: приёмник входящих
-- не заполнял chat_type, и все карточки получали значение по умолчанию 'private'.
-- Признак группы в MAX (как и в Telegram) — отрицательный идентификатор чата.
-- Правим только те карточки, где чат MAX отрицательный и тип всё ещё 'private'.
UPDATE t_p45929761_bold_move_project.touch_clients
SET chat_type = 'group',
    group_title = COALESCE(NULLIF(group_title, ''), NULLIF(name, ''), 'Группа MAX')
WHERE chat_type = 'private'
  AND (channel_ids->>'max') ~ '^-\d+$';