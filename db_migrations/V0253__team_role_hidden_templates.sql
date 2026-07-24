CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.team_role_hidden_templates (
  company_id INTEGER NOT NULL REFERENCES t_p45929761_bold_move_project.users(id),
  template_id INTEGER NOT NULL REFERENCES t_p45929761_bold_move_project.team_roles(id),
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (company_id, template_id)
);