-- Апрель: добавим демо-контракт
INSERT INTO t_p45929761_bold_move_project.live_chats (session_id, client_name, phone, status, created_at, last_message_at, source, contract_sum, prepayment, material_cost, measure_cost, install_cost)
VALUES ('demo-apr-1', 'Евгений Захаров', '+79161230200', 'done', '2026-04-20 10:00:00+00', '2026-04-20 10:00:00+00', 'chat', 95000, 40000, 22000, 3500, 15000);

-- Июль 2026
INSERT INTO t_p45929761_bold_move_project.live_chats (session_id, client_name, phone, status, created_at, last_message_at, source, contract_sum, prepayment, material_cost, measure_cost, install_cost)
VALUES ('demo-jul-1', 'Андрей Соколов', '+79161230201', 'done', '2026-07-10 10:00:00+00', '2026-07-10 10:00:00+00', 'chat', 88000, 35000, 19000, 3500, 13000);

-- Август 2026
INSERT INTO t_p45929761_bold_move_project.live_chats (session_id, client_name, phone, status, created_at, last_message_at, source, contract_sum, prepayment, material_cost, measure_cost, install_cost)
VALUES ('demo-aug-1', 'Марина Белова', '+79161230202', 'done', '2026-08-14 11:00:00+00', '2026-08-14 11:00:00+00', 'chat', 110000, 45000, 25000, 3500, 16000);

-- Сентябрь 2026
INSERT INTO t_p45929761_bold_move_project.live_chats (session_id, client_name, phone, status, created_at, last_message_at, source, contract_sum, prepayment, material_cost, measure_cost, install_cost)
VALUES ('demo-sep-1', 'Павел Громов', '+79161230203', 'done', '2026-09-05 09:00:00+00', '2026-09-05 09:00:00+00', 'chat', 67000, 27000, 14000, 3500, 10000),
       ('demo-sep-2', 'Лариса Мищенко', '+79161230204', 'new', '2026-09-18 14:00:00+00', '2026-09-18 14:00:00+00', 'chat', NULL, NULL, NULL, NULL, NULL);

-- Октябрь 2026
INSERT INTO t_p45929761_bold_move_project.live_chats (session_id, client_name, phone, status, created_at, last_message_at, source, contract_sum, prepayment, material_cost, measure_cost, install_cost)
VALUES ('demo-oct-1', 'Игорь Лебедев', '+79161230205', 'done', '2026-10-08 10:00:00+00', '2026-10-08 10:00:00+00', 'chat', 145000, 60000, 32000, 3500, 22000),
       ('demo-oct-2', 'Светлана Новак', '+79161230206', 'call', '2026-10-22 15:00:00+00', '2026-10-22 15:00:00+00', 'chat', NULL, NULL, NULL, NULL, NULL);

-- Ноябрь 2026
INSERT INTO t_p45929761_bold_move_project.live_chats (session_id, client_name, phone, status, created_at, last_message_at, source, contract_sum, prepayment, material_cost, measure_cost, install_cost)
VALUES ('demo-nov-1', 'Роман Власов', '+79161230207', 'done', '2026-11-12 10:00:00+00', '2026-11-12 10:00:00+00', 'chat', 92000, 38000, 21000, 3500, 14000);

-- Декабрь 2026
INSERT INTO t_p45929761_bold_move_project.live_chats (session_id, client_name, phone, status, created_at, last_message_at, source, contract_sum, prepayment, material_cost, measure_cost, install_cost)
VALUES ('demo-dec-1', 'Татьяна Орехова', '+79161230208', 'new', '2026-12-03 09:00:00+00', '2026-12-03 09:00:00+00', 'chat', NULL, NULL, NULL, NULL, NULL),
       ('demo-dec-2', 'Владимир Кузьмин', '+79161230209', 'call', '2026-12-17 13:00:00+00', '2026-12-17 13:00:00+00', 'chat', NULL, NULL, NULL, NULL, NULL);
