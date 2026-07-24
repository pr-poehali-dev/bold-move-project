-- ВРЕМЕННЫЙ тестовый сотрудник для QA-проверки блокировки доступа. Будет удалён после теста.
UPDATE t_p45929761_bold_move_project.users
SET email_verified = true, approved = true, role = 'manager', company_id = 8, active = true
WHERE id = 69 AND email = 'qa_probe_emp@demo.local';