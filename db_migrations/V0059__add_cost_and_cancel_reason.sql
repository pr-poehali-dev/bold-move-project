ALTER TABLE t_p45929761_bold_move_project.live_chats
  ADD COLUMN IF NOT EXISTS material_cost numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS measure_cost numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS install_cost numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS cancel_reason text NULL;
