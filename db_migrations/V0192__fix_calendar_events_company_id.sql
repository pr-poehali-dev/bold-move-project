-- Проставляем company_id для событий где он ещё null — берём из заявки
UPDATE t_p45929761_bold_move_project.calendar_events ce
SET company_id = lc.company_id
FROM t_p45929761_bold_move_project.live_chats lc
WHERE ce.client_id = lc.id
  AND ce.company_id IS NULL
  AND lc.company_id IS NOT NULL;