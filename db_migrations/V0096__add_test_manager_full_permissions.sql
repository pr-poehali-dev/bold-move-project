-- Тестовый менеджер с полными правами (пароль: test1234)
INSERT INTO t_p45929761_bold_move_project.users
  (email, password_hash, name, phone, role, approved, company_id, permissions)
VALUES
  (
    'test.manager.full@demo.local',
    '937e8d5fbb48bd4949536cd65b8d35c426b80d2f830c5c308e2cdec422ae2244',
    'Тест-менеджер (все права)',
    '+70000000002',
    'manager',
    true,
    2,
    '{
      "crm_view": true,
      "agent_view": true,
      "crm_edit": true,
      "kanban": true,
      "calendar": true,
      "finance": true,
      "analytics": true,
      "files": true,
      "settings": true
    }'::jsonb
  )
ON CONFLICT (email) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  name = EXCLUDED.name;
