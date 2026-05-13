ALTER TABLE t_p45929761_bold_move_project.live_chats
  ADD COLUMN IF NOT EXISTS project_id INTEGER NULL;

CREATE INDEX IF NOT EXISTS live_chats_project_id_idx
  ON t_p45929761_bold_move_project.live_chats (project_id)
  WHERE project_id IS NOT NULL;