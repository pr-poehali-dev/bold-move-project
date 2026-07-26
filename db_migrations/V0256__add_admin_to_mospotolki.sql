-- Добавление сотрудника-администратора в компанию MosPotolki (id=8)
-- Роль: Администратор (team_role_id=5), полные права скопированы из шаблона роли.
-- Пароль-заглушка (не рабочий bcrypt) — владелец задаёт реальный через «Сбросить пароль».
INSERT INTO t_p45929761_bold_move_project.users
  (email, password_hash, name, phone, role, approved, company_id, invited_by,
   permissions, team_role_id, active)
SELECT
  'mospotolkipro@yandex.ru',
  'NEEDS_RESET',
  'Администратор',
  '+79999999999',
  'manager',
  TRUE,
  8,
  8,
  (SELECT permissions FROM t_p45929761_bold_move_project.team_roles WHERE id=5),
  5,
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM t_p45929761_bold_move_project.users
  WHERE LOWER(email) = 'mospotolkipro@yandex.ru' AND removed_at IS NULL
);