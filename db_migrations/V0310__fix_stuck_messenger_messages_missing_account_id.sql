UPDATE t_p45929761_bold_move_project.touch_events
SET status = 'pending',
    account_id = (SELECT id FROM t_p45929761_bold_move_project.messenger_accounts WHERE company_id=8 AND channel='telegram' AND is_active=TRUE AND auth_status='authorized' ORDER BY id LIMIT 1)
WHERE id IN (1918, 1920) AND channel = 'telegram';

UPDATE t_p45929761_bold_move_project.touch_events
SET status = 'pending',
    account_id = (SELECT id FROM t_p45929761_bold_move_project.messenger_accounts WHERE company_id=8 AND channel='max' AND is_active=TRUE AND auth_status='authorized' ORDER BY id LIMIT 1)
WHERE id = 1919 AND channel = 'max';