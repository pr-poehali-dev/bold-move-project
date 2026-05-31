-- Помечаем аккаунт id=59 как единый мастер-демо
UPDATE t_p45929761_bold_move_project.users
SET company_name = 'demo_master',
    demo_expires_at = NULL
WHERE id = 59;