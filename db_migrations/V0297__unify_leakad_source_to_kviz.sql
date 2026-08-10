UPDATE t_p45929761_bold_move_project.live_chats
SET source = 'Квиз'
WHERE created_via = 'leakad_webhook' AND source IN ('Egokad CRM', 'Leakad-заявки');