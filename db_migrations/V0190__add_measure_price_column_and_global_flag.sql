-- Колонка "Замер ₽" в прайсе
ALTER TABLE t_p45929761_bold_move_project.ai_prices
  ADD COLUMN measure_price integer NOT NULL DEFAULT 100;

-- Глобальный флаг "Замер по прайсу"
ALTER TABLE t_p45929761_bold_move_project.auto_rules_settings
  ADD COLUMN use_measure_price boolean NOT NULL DEFAULT false;