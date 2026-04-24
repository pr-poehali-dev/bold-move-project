-- Перепривязываем все заявки со старого мастер-аккаунта (id=3) на реальный аккаунт (id=2)
UPDATE t_p45929761_bold_move_project.live_chats
SET company_id = 2
WHERE company_id = 3;

UPDATE t_p45929761_bold_move_project.calendar_events
SET company_id = 2
WHERE company_id = 3;

UPDATE t_p45929761_bold_move_project.saved_estimates
SET company_id = 2
WHERE company_id = 3;

-- Обновляем имя аккаунта
UPDATE t_p45929761_bold_move_project.users
SET name = 'Мастер (Юра)'
WHERE id = 2;
