-- Гранулярные права сотрудников (JSONB)
-- Структура: {"crm_view": true, "crm_edit": true, "finance": true, "calendar": true, "analytics": true, "team_view": false, ...}
-- NULL = полный доступ (для владельцев company и не-сотрудников)
ALTER TABLE t_p45929761_bold_move_project.users
  ADD COLUMN IF NOT EXISTS permissions JSONB;

-- Флаг "пароль ещё не показывали владельцу" — для нового флоу приглашения
ALTER TABLE t_p45929761_bold_move_project.users
  ADD COLUMN IF NOT EXISTS temp_password_plain TEXT;
