-- Добавляем новые дефолтные правила расходов (выключенные) для всех компаний у которых уже есть записи в auto_rules_v2
-- Используем INSERT ... ON CONFLICT DO NOTHING чтобы не дублировать

INSERT INTO auto_rules_v2 (company_id, key, label, row_type, sort_order, is_default, enabled, visible)
SELECT DISTINCT company_id, 'manager_cost', 'Менеджер', 'cost', 3, true, false, true
FROM auto_rules_v2
ON CONFLICT (company_id, key) DO NOTHING;

INSERT INTO auto_rules_v2 (company_id, key, label, row_type, sort_order, is_default, enabled, visible)
SELECT DISTINCT company_id, 'technolog_cost', 'Технолог', 'cost', 4, true, false, true
FROM auto_rules_v2
ON CONFLICT (company_id, key) DO NOTHING;

INSERT INTO auto_rules_v2 (company_id, key, label, row_type, sort_order, is_default, enabled, visible)
SELECT DISTINCT company_id, 'ads_cost', 'Реклама (CAC)', 'cost', 5, true, false, true
FROM auto_rules_v2
ON CONFLICT (company_id, key) DO NOTHING;

INSERT INTO auto_rules_v2 (company_id, key, label, row_type, sort_order, is_default, enabled, visible)
SELECT DISTINCT company_id, 'other_cost', 'Другое', 'cost', 6, true, false, true
FROM auto_rules_v2
ON CONFLICT (company_id, key) DO NOTHING;
