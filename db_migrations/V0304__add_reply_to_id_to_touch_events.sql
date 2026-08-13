ALTER TABLE t_p45929761_bold_move_project.touch_events
  ADD COLUMN IF NOT EXISTS reply_to_id INTEGER NULL;

CREATE INDEX IF NOT EXISTS idx_touch_events_reply_to_id
  ON t_p45929761_bold_move_project.touch_events(reply_to_id);