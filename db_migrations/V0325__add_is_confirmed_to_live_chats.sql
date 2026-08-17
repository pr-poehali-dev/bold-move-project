-- Новое поле "Подтверждено" — второй слайдер на этапе "Выполнено" (рядом с "Проверено").
-- По аналогии с is_verified.
ALTER TABLE t_p45929761_bold_move_project.live_chats
ADD COLUMN is_confirmed boolean NOT NULL DEFAULT false;
