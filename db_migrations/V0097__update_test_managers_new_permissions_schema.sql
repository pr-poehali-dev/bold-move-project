-- Обновляем тестового менеджера (0 прав) — новая схема прав
UPDATE t_p45929761_bold_move_project.users
SET permissions = '{
  "crm_view": false, "agent_view": false,
  "clients_view": false, "clients_edit": false,
  "orders_edit": false,
  "kanban_view": false, "kanban_edit": false,
  "calendar_view": false, "calendar_edit": false,
  "analytics_view": false,
  "finance_view": false,
  "files_view": false, "files_edit": false,
  "prices_view": false, "prices_edit": false,
  "rules_view": false, "rules_edit": false,
  "prompt_view": false, "prompt_edit": false,
  "faq_view": false, "faq_edit": false,
  "corrections_view": false, "corrections_edit": false,
  "field_contacts": false, "field_address": false, "field_dates": false,
  "field_finance": false, "field_notes": false, "field_files": false, "field_cancel": false
}'::jsonb
WHERE email = 'test.manager@demo.local';

-- Обновляем тестового менеджера (все права)
UPDATE t_p45929761_bold_move_project.users
SET permissions = '{
  "crm_view": true, "agent_view": true,
  "clients_view": true, "clients_edit": true,
  "orders_edit": true,
  "kanban_view": true, "kanban_edit": true,
  "calendar_view": true, "calendar_edit": true,
  "analytics_view": true,
  "finance_view": true,
  "files_view": true, "files_edit": true,
  "prices_view": true, "prices_edit": true,
  "rules_view": true, "rules_edit": true,
  "prompt_view": true, "prompt_edit": true,
  "faq_view": true, "faq_edit": true,
  "corrections_view": true, "corrections_edit": true,
  "field_contacts": true, "field_address": true, "field_dates": true,
  "field_finance": true, "field_notes": true, "field_files": true, "field_cancel": true
}'::jsonb
WHERE email = 'test.manager.full@demo.local';

-- Обновляем Ивана (реального менеджера) — базовые права просмотра
UPDATE t_p45929761_bold_move_project.users
SET permissions = '{
  "crm_view": true, "agent_view": false,
  "clients_view": true, "clients_edit": false,
  "orders_edit": false,
  "kanban_view": false, "kanban_edit": false,
  "calendar_view": true, "calendar_edit": false,
  "analytics_view": false,
  "finance_view": false,
  "files_view": true, "files_edit": false,
  "prices_view": false, "prices_edit": false,
  "rules_view": false, "rules_edit": false,
  "prompt_view": false, "prompt_edit": false,
  "faq_view": false, "faq_edit": false,
  "corrections_view": false, "corrections_edit": false,
  "field_contacts": true, "field_address": true, "field_dates": true,
  "field_finance": false, "field_notes": true, "field_files": true, "field_cancel": false
}'::jsonb
WHERE email = '19.jeka.95@gmail.com';
