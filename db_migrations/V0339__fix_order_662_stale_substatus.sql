-- Заявка №662: measure_date уже назначена (31 августа), но sub_status всё ещё
-- указывал на "Дата замера не назначена" — противоречие. Снимаем устаревший подэтап.
UPDATE t_p45929761_bold_move_project.live_chats
SET sub_status = NULL
WHERE id = 662 AND sub_status = '12';