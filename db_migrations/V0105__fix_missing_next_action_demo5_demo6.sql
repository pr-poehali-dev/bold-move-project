UPDATE t_p45929761_bold_move_project.demo_companies
SET next_action = 'Позвонить, уточнить интерес',
    next_action_date = '2026-05-01'
WHERE id IN (5, 6) AND (next_action IS NULL OR next_action = '');