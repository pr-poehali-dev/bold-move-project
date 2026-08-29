-- Назначить Артёма Дудина (user 68, менеджер компании 8) вторым менеджером
-- на все заявки компании, кроме скрытых из воронки.
UPDATE t_p45929761_bold_move_project.live_chats
SET assigned_manager2 = 68,
    updated_at = NOW()
WHERE company_id = 8
  AND status IN ('new', 'call', 'measure', 'measured', 'contract', 'prepaid', 'install_scheduled', 'install_done', 'extra_paid', 'done', 'cancelled');