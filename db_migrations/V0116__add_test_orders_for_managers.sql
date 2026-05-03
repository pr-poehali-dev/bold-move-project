-- Тестовые заказы для менеджеров company_id=2

-- Заказ для ИВАН МАНАГЕРОВИЧ (ТЕСТОВ) — id=13
INSERT INTO live_chats (session_id, client_name, phone, status, address, area, contract_sum, prepayment, source, notes, company_id, tags)
VALUES ('test-order-manager-13', 'Клиент Тестов А.В.', '+79161234567', 'new', 'г. Москва, ул. Тестовая, д. 1, кв. 5', 32.5, 45000, 15000, 'manual', 'Тестовый заказ менеджера ИВАН МАНАГЕРОВИЧ', 2, '{тест}');

-- Заказ для Тест-менеджер (0 прав) — id=15
INSERT INTO live_chats (session_id, client_name, phone, status, address, area, contract_sum, source, notes, company_id, tags)
VALUES ('test-order-manager-15', 'Клиент Петров Б.С.', '+79261234568', 'in_progress', 'г. Москва, ул. Проверочная, д. 3, кв. 12', 48.0, 67000, 'manual', 'Тестовый заказ менеджера 0 прав', 2, '{тест}');

-- Заказ для Тест-менеджер (все права) — id=16
INSERT INTO live_chats (session_id, client_name, phone, status, address, area, contract_sum, prepayment, install_cost, measure_cost, source, notes, company_id, tags)
VALUES ('test-order-manager-16', 'Клиент Сидоров В.Г.', '+79361234569', 'measure', 'г. Москва, пр. Демонстрационный, д. 7, кв. 33', 56.0, 89000, 30000, 26700, 8900, 'manual', 'Тестовый заказ менеджера все права', 2, '{тест}');
