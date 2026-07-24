-- Мягкое скрытие временного QA-сотрудника (id=69) после проверки. Помечаем как removed и гасим сессии.
UPDATE t_p45929761_bold_move_project.users
SET removed_at = NOW(),
    active = false,
    company_id = NULL,
    email = '_removed_69_qa_probe_emp@demo.local'
WHERE id = 69 AND email = 'qa_probe_emp@demo.local';
UPDATE t_p45929761_bold_move_project.user_sessions
SET expires_at = NOW()
WHERE user_id = 69;