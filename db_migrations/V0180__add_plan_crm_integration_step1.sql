ALTER TABLE t_p45929761_bold_move_project.plan_projects
  ADD COLUMN IF NOT EXISTS crm_chat_id integer NULL;

CREATE INDEX IF NOT EXISTS idx_plan_projects_crm_chat_id
  ON t_p45929761_bold_move_project.plan_projects(crm_chat_id);

CREATE INDEX IF NOT EXISTS idx_live_chats_project_id
  ON t_p45929761_bold_move_project.live_chats(project_id);

INSERT INTO t_p45929761_bold_move_project.kanban_columns (title, color, position, company_id)
VALUES ('С построителя', '#7c3aed', -1, 2);
