-- company: все расходы выключены
UPDATE t_p45929761_bold_move_project.default_auto_rules
SET enabled = false, pct = NULL
WHERE role = 'company' AND row_type = 'cost';

-- installer: правильные значения
UPDATE t_p45929761_bold_move_project.default_auto_rules
SET enabled = false, visible = true
WHERE role = 'installer' AND key = 'other_cost';
