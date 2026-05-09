ALTER TABLE t_p45929761_bold_move_project.ai_prices
  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

ALTER TABLE t_p45929761_bold_move_project.ai_prices
  ADD COLUMN IF NOT EXISTS category_image_url TEXT DEFAULT NULL;
