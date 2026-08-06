-- Приводим метки клиентов к правилу "1 метка, только 2 варианта: Недозвон / Перезвонить".
-- Приоритет: если среди старых меток была "Недозвон" — оставляем именно её,
-- во всех остальных случаях (любые другие метки, включая кастомные/тестовые) — "Перезвонить".

UPDATE t_p45929761_bold_move_project.live_chats
SET tags = ARRAY['Недозвон']
WHERE tags IS NOT NULL AND 'Недозвон' = ANY(tags);

UPDATE t_p45929761_bold_move_project.live_chats
SET tags = ARRAY['Перезвонить']
WHERE tags IS NOT NULL
  AND array_length(tags, 1) > 0
  AND NOT ('Недозвон' = ANY(tags));