-- Поле management_cost — системная колонка для отдельного режима
-- "Менеджмент по прайсу" (auto_rules_settings.use_management_price = true).
-- Раньше код сметы ошибочно писал сюда результат пользовательской статьи
-- "Менеджер" (row_key='manager_cost'), из-за чего в P&L задваивались деньги:
-- одна и та же сумма показывалась и как "Менеджмент", и как "Менеджер".
-- Логика уже исправлена (см. backend/auth/handlers/estimates.py), здесь чистим
-- уже накопленный мусор: обнуляем management_cost там, где режим "по прайсу"
-- выключен (или не настроен) — там это поле не должно быть заполнено вообще.
UPDATE t_p45929761_bold_move_project.live_chats lc
SET management_cost = NULL
FROM t_p45929761_bold_move_project.auto_rules_settings ars
WHERE ars.company_id = lc.company_id
  AND COALESCE(ars.use_management_price, FALSE) = FALSE
  AND lc.management_cost IS NOT NULL;

-- Заявки, у чьей компании вообще нет строки в auto_rules_settings (режим точно не включён)
UPDATE t_p45929761_bold_move_project.live_chats lc
SET management_cost = NULL
WHERE lc.management_cost IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM t_p45929761_bold_move_project.auto_rules_settings ars
      WHERE ars.company_id = lc.company_id AND COALESCE(ars.use_management_price, FALSE) = TRUE
  );
