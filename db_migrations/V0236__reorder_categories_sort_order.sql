-- Устанавливаем правильный порядок категорий:
-- 1. Полотна, 2. Профили, 3. Парящие/теневые, 4. Закладные, 5. Освещение, 6. Другое, 7. Монтаж

UPDATE t_p45929761_bold_move_project.ai_prices
SET sort_order = sort_order + CASE
  WHEN category = 'Полотна'              THEN 1000
  WHEN category = 'Профиль стандартный' THEN 2000
  WHEN category = 'Теневой профиль'     THEN 3000
  WHEN category = 'Парящий профиль'     THEN 3100
  WHEN category = 'Ниши для штор'       THEN 3200
  WHEN category = 'Двухуровневые'       THEN 3300
  WHEN category = 'Закладные'           THEN 4000
  WHEN category = 'Освещение'           THEN 5000
  WHEN category = 'Вентиляция'          THEN 6000
  WHEN category = 'Вставки и заглушки'  THEN 6100
  WHEN category = 'Углы и заглушки'     THEN 6200
  WHEN category = 'Дополнительно'       THEN 6300
  WHEN category = 'Монтаж'              THEN 9000
  ELSE 7000
END;
