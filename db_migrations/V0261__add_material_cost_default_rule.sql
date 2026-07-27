-- Добавляем "Материалы" в дефолтные правила авто-расчёта затрат,
-- чтобы её можно было включать/выключать в карточке через ту же модалку правил
INSERT INTO t_p45929761_bold_move_project.default_auto_rules (role, key, label, pct, enabled, visible, row_type, sort_order) VALUES
  ('installer', 'material_cost', 'Материалы', NULL, false, true, 'cost', 0),
  ('company',   'material_cost', 'Материалы', NULL, false, true, 'cost', 0)
ON CONFLICT (role, key) DO NOTHING;