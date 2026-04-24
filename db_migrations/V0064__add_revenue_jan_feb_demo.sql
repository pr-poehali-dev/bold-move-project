UPDATE t_p45929761_bold_move_project.live_chats
SET contract_sum = 78000, prepayment = 30000, extra_payment = 48000,
    material_cost = 16000, measure_cost = 3500, install_cost = 11000,
    status = 'done'
WHERE session_id = 'demo-jan-1';

UPDATE t_p45929761_bold_move_project.live_chats
SET contract_sum = 54000, prepayment = 20000, extra_payment = 34000,
    material_cost = 11000, measure_cost = 3500, install_cost = 8000,
    status = 'done'
WHERE session_id = 'demo-feb-1';
