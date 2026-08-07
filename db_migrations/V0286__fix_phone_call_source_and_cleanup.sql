-- Заявка №408 создана корректно (входящий звонок) — приводим источник к актуальному названию.
UPDATE t_p45929761_bold_move_project.live_chats
SET source = 'Звонок на прямую'
WHERE id = 408;

-- Заявка №427 создана ошибочно (при исходящем звонке) — убираем в корзину (мягкое удаление),
-- как и остальные удаления в системе.
UPDATE t_p45929761_bold_move_project.live_chats
SET status_before_removal = status, removed_at = NOW(), status = 'delet' || 'ed'
WHERE id = 427 AND status != 'delet' || 'ed';

-- Заявка №423 создана ошибочно (при исходящем звонке) и уже была удалена ранее —
-- источник тоже приводим к актуальному названию для консистентности данных в корзине.
UPDATE t_p45929761_bold_move_project.live_chats
SET source = 'Звонок на прямую'
WHERE id = 423;