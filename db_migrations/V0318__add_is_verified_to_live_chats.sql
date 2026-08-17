-- Флаг "заявка проверена" — используется на этапе "Выполнено" вместо флага
-- is_service (сервис там не имеет смысла: заявка уже завершена как основной
-- заказ или сервисная доделка, но проверка качества/оплаты — отдельная вещь).
ALTER TABLE t_p45929761_bold_move_project.live_chats
  ADD COLUMN is_verified boolean NOT NULL DEFAULT false;
