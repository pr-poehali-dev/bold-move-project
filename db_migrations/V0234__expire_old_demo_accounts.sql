-- Помечаем старые демо-аккаунты как истёкшие чтобы cleanup мог их удалить
UPDATE t_p45929761_bold_move_project.users
SET demo_expires_at = '2000-01-01'::timestamptz
WHERE is_demo = TRUE AND id NOT IN (59) AND id BETWEEN 50 AND 58;