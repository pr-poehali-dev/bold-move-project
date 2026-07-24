-- Восстановление аккаунта Алексея (технолог, id=60) как сотрудника компании MosPotolki (id=8)
-- Было: удалённая компания. Стало: активный сотрудник (manager) с полным доступом к CRM MosPotolki
UPDATE t_p45929761_bold_move_project.users
SET removed_at = NULL,
    email      = 'a891341267802@gmail.com',
    role       = 'manager',
    company_id = 8,
    approved   = true,
    permissions = '{
      "crm_view": true, "faq_edit": true, "faq_view": true, "plan_view": true,
      "agent_view": true, "files_edit": true, "files_view": true, "rules_edit": true,
      "rules_view": true, "field_dates": true, "field_files": true, "field_notes": true,
      "kanban_edit": true, "kanban_view": true, "orders_edit": true, "orders_view": true,
      "prices_edit": true, "prices_view": true, "prompt_edit": true, "prompt_view": true,
      "clients_edit": true, "clients_view": true, "field_cancel": true, "finance_view": true,
      "profile_view": true, "support_view": true, "tariffs_view": true, "calendar_edit": true,
      "calendar_view": true, "field_address": true, "field_finance": true, "analytics_view": true,
      "field_contacts": true, "admin_panel_view": true, "corrections_edit": true, "corrections_view": true
    }'::jsonb
WHERE id = 60;