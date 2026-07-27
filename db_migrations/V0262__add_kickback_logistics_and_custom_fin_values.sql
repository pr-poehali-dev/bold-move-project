-- Добавляем новые типовые статьи затрат "Откат" и "Логистика" в шаблон компании
INSERT INTO t_p45929761_bold_move_project.default_auto_rules (role, key, label, pct, enabled, visible, row_type, sort_order) VALUES
  ('company',   'kickback_cost',  'Откат',      NULL, false, true, 'cost', 7),
  ('company',   'logistics_cost', 'Логистика',  NULL, false, true, 'cost', 8),
  ('installer', 'kickback_cost',  'Откат',      NULL, false, true, 'cost', 7),
  ('installer', 'logistics_cost', 'Логистика',  NULL, false, true, 'cost', 8)
ON CONFLICT (role, key) DO NOTHING;

-- Таблица для хранения сумм ПРОИЗВОЛЬНЫХ (кастомных) статей затрат/доходов по каждому заказу.
-- Встроенные статьи (material_cost, measure_cost, install_cost) остаются колонками live_chats как раньше.
-- Эта таблица — только для статей, которых нет как отдельной колонки (Откат, Логистика, и любые другие кастомные).
CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.client_custom_fin_values (
  id          SERIAL PRIMARY KEY,
  client_id   INTEGER      NOT NULL REFERENCES t_p45929761_bold_move_project.live_chats(id),
  row_key     VARCHAR(64)  NOT NULL,
  value       NUMERIC(12,2) NULL,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT client_custom_fin_values_unique UNIQUE (client_id, row_key)
);
CREATE INDEX IF NOT EXISTS idx_client_custom_fin_values_client ON t_p45929761_bold_move_project.client_custom_fin_values(client_id);