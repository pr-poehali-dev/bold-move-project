ALTER TABLE t_p45929761_bold_move_project.ai_prices
  ALTER COLUMN bundle SET DEFAULT '';

UPDATE t_p45929761_bold_move_project.ai_prices
SET bundle = '' WHERE bundle IN ('[]', '[""]');
