ALTER TABLE t_p45929761_bold_move_project.ai_prices
  ADD COLUMN IF NOT EXISTS mounting_id INTEGER;

UPDATE t_p45929761_bold_move_project.ai_prices SET mounting_id = 46 WHERE id IN (1,2,3,4,5,7,8);
UPDATE t_p45929761_bold_move_project.ai_prices SET mounting_id = 47 WHERE id = 6;
UPDATE t_p45929761_bold_move_project.ai_prices SET mounting_id = 48 WHERE id IN (9,10,11);
UPDATE t_p45929761_bold_move_project.ai_prices SET mounting_id = 49 WHERE id IN (12,13,60);
UPDATE t_p45929761_bold_move_project.ai_prices SET mounting_id = 50 WHERE id IN (15,16,17);
UPDATE t_p45929761_bold_move_project.ai_prices SET mounting_id = 51 WHERE id IN (30,31,32,33,34,35,36,37,38,39,70);
UPDATE t_p45929761_bold_move_project.ai_prices SET mounting_id = 56 WHERE id = 40;
UPDATE t_p45929761_bold_move_project.ai_prices SET mounting_id = 53 WHERE id IN (41,42);
UPDATE t_p45929761_bold_move_project.ai_prices SET mounting_id = 54 WHERE id IN (43,44,45);
UPDATE t_p45929761_bold_move_project.ai_prices SET mounting_id = 73 WHERE id IN (18,19,20,21,22,23,24,25,26,27,59);
UPDATE t_p45929761_bold_move_project.ai_prices SET mounting_id = 58 WHERE id = 71;
UPDATE t_p45929761_bold_move_project.ai_prices SET mounting_id = 51 WHERE id IN (66,67);