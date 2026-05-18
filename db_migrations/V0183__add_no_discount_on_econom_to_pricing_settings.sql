ALTER TABLE t_p45929761_bold_move_project.pricing_settings
  ADD COLUMN IF NOT EXISTS no_discount_on_econom boolean NOT NULL DEFAULT false;