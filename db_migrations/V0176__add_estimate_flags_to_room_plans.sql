ALTER TABLE t_p45929761_bold_move_project.room_plans
  ADD COLUMN IF NOT EXISTS include_in_estimate boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_drawing boolean NOT NULL DEFAULT true;