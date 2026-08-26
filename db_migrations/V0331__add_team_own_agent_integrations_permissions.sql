-- Новые права на вкладки внутри «Настроек компании».
-- Раньше «Команда», «Свой агент» и «Интеграции» были доступны только владельцу
-- компании. Теперь у каждой вкладки своё право. Чтобы никто не потерял доступ,
-- включаем их всем, у кого уже открыт вход в настройки (admin_panel_view = true).

UPDATE t_p45929761_bold_move_project.users
SET permissions = permissions
  || jsonb_build_object(
       'team_view',         true,
       'own_agent_view',    true,
       'integrations_view', true
     )
WHERE permissions IS NOT NULL
  AND permissions->>'admin_panel_view' = 'true';

UPDATE t_p45929761_bold_move_project.team_roles
SET permissions = permissions
  || jsonb_build_object(
       'team_view',         true,
       'own_agent_view',    true,
       'integrations_view', true
     )
WHERE permissions IS NOT NULL
  AND permissions->>'admin_panel_view' = 'true';
