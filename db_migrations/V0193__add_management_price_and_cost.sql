-- Колонка "Менеджмент ₽" в прайсе (дефолт 100, как у монтажа и замера)
ALTER TABLE t_p45929761_bold_move_project.ai_prices
  ADD COLUMN management_price integer NOT NULL DEFAULT 100;

-- Глобальный флаг "Менеджмент по прайсу"
ALTER TABLE t_p45929761_bold_move_project.auto_rules_settings
  ADD COLUMN use_management_price boolean NOT NULL DEFAULT false;

-- Отдельное поле management_cost в заявках
ALTER TABLE t_p45929761_bold_move_project.live_chats
  ADD COLUMN management_cost integer NULL;