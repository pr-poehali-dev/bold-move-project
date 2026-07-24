ALTER TABLE t_p45929761_bold_move_project.team_roles
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;

UPDATE t_p45929761_bold_move_project.team_roles
  SET is_template = true
  WHERE id IN (1,2,3,4);