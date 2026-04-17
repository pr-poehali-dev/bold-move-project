UPDATE t_p45929761_bold_move_project.ai_prices
SET calc_rule = '', bundle = ''
WHERE calc_rule != '' OR bundle != '';
