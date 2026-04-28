CREATE INDEX IF NOT EXISTS idx_users_company_id
  ON t_p45929761_bold_move_project.users(company_id)
  WHERE company_id IS NOT NULL AND removed_at IS NULL;