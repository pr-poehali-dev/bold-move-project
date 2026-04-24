UPDATE t_p45929761_bold_move_project.live_chats
SET contract_sum = 85000, prepayment = 30000, status = 'done'
WHERE session_id = 'demo-march-1';

UPDATE t_p45929761_bold_move_project.live_chats
SET contract_sum = 62000, prepayment = 20000, status = 'extra_paid'
WHERE session_id = 'demo-march-2';

UPDATE t_p45929761_bold_move_project.live_chats
SET contract_sum = 47000, prepayment = 15000, status = 'install_done'
WHERE session_id = 'demo-march-3';

UPDATE t_p45929761_bold_move_project.live_chats
SET contract_sum = 120000, prepayment = 50000, status = 'done'
WHERE session_id = 'demo-may-1';

UPDATE t_p45929761_bold_move_project.live_chats
SET contract_sum = 73000, prepayment = 25000, status = 'contract'
WHERE session_id = 'demo-may-2';
