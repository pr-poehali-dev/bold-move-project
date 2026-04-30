-- Создаём тестового менеджера с нулевыми правами (пароль: test1234)
-- SHA-256("test1234") = 937e8d5fbb48bd4949536cd65b8d35c426b80d2f830c5c308e2cdec422ae2244
INSERT INTO t_p45929761_bold_move_project.users
  (email, password_hash, name, phone, role, approved, company_id, permissions)
VALUES
  (
    'test.manager@demo.local',
    '937e8d5fbb48bd4949536cd65b8d35c426b80d2f830c5c308e2cdec422ae2244',
    'Тест-менеджер (0 прав)',
    '+70000000001',
    'manager',
    true,
    2,
    '{
      "crm_view": false,
      "agent_view": false,
      "crm_edit": false,
      "kanban": false,
      "calendar": false,
      "finance": false,
      "analytics": false,
      "files": false,
      "settings": false
    }'::jsonb
  )
ON CONFLICT (email) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  name = EXCLUDED.name;
