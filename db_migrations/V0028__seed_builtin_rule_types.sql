INSERT INTO ai_rule_types (name, label, description, placeholder, sort_order, active)
SELECT 'calc_rule', 'Если не указано количество — считать как', 'Формула расчёта количества. Используй: area (площадь), perimeter (периметр), const:N (фиксированное число)', 'Например: area * 1.0 или const:1', 10, true
WHERE NOT EXISTS (SELECT 1 FROM ai_rule_types WHERE name = 'calc_rule');

INSERT INTO ai_rule_types (name, label, description, placeholder, sort_order, active)
SELECT 'bundle', 'Логика привязки комплектов', 'Позиции которые добавляются автоматически вместе с этой', 'Например: добавить Лампа GX53 и Закладная', 20, true
WHERE NOT EXISTS (SELECT 1 FROM ai_rule_types WHERE name = 'bundle');