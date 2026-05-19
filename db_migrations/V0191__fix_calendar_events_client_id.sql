-- Привязываем старые события к заявкам по дате и типу события
UPDATE t_p45929761_bold_move_project.calendar_events ce
SET client_id = lc.id,
    company_id = COALESCE(ce.company_id, lc.company_id)
FROM t_p45929761_bold_move_project.live_chats lc
WHERE ce.client_id IS NULL
  AND ce.event_type = 'measure'
  AND ce.start_time = lc.measure_date;

UPDATE t_p45929761_bold_move_project.calendar_events ce
SET client_id = lc.id,
    company_id = COALESCE(ce.company_id, lc.company_id)
FROM t_p45929761_bold_move_project.live_chats lc
WHERE ce.client_id IS NULL
  AND ce.event_type = 'install'
  AND ce.start_time = lc.install_date;