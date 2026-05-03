-- Сбрасываем все в false для installer
UPDATE t_p45929761_bold_move_project.default_auto_rules
SET enabled = false
WHERE role = 'installer';

-- Включаем нужные для installer
UPDATE t_p45929761_bold_move_project.default_auto_rules
SET enabled = true
WHERE role = 'installer' AND key IN ('measure_cost', 'install_cost', 'ads_cost', 'prepayment', 'extra_payment');

-- Сбрасываем все в false для company
UPDATE t_p45929761_bold_move_project.default_auto_rules
SET enabled = false
WHERE role = 'company';

-- Включаем нужные для company
UPDATE t_p45929761_bold_move_project.default_auto_rules
SET enabled = true
WHERE role = 'company' AND key IN ('prepayment', 'extra_payment');
