-- Гарантируем колонку company_id (она уже есть из V0076), добавляем индекс для фильтрации команды
CREATE INDEX IF NOT EXISTS idx_users_company_id ON t_p45929761_bold_move_project.users(company_id);

-- Поле для временного пароля (показывается владельцу один раз при создании сотрудника)
ALTER TABLE t_p45929761_bold_move_project.users
  ADD COLUMN IF NOT EXISTS invited_by INTEGER REFERENCES t_p45929761_bold_move_project.users(id);
