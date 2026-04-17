
ALTER TABLE t_p45929761_bold_move_project.ai_prices
  ADD COLUMN IF NOT EXISTS calc_rule TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bundle TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN t_p45929761_bold_move_project.ai_prices.calc_rule IS
  'Правило расчёта количества если не указано. Примеры: "perimeter*0.25", "const:1", "area*1.3". Пусто = клиент должен указать явно.';

COMMENT ON COLUMN t_p45929761_bold_move_project.ai_prices.bundle IS
  'JSON-массив ID позиций которые добавляются автоматически. Пример: [42,17]';

UPDATE t_p45929761_bold_move_project.ai_prices
  SET calc_rule = 'perimeter*1.0'
  WHERE name = 'Стеновой алюминий';

UPDATE t_p45929761_bold_move_project.ai_prices
  SET calc_rule = 'perimeter*1.0'
  WHERE name = 'Стеновой ПВХ';

UPDATE t_p45929761_bold_move_project.ai_prices
  SET calc_rule = 'area*1.0'
  WHERE name IN ('MSD Classic матовый','MSD Premium матовый','MSD Evolution матовый','BAUF Германия матовый','Цветной матовый MSD','Тканевый ДЕСКОР Германия');

UPDATE t_p45929761_bold_move_project.ai_prices
  SET calc_rule = 'area*1.0'
  WHERE name IN ('Раскрой ПВХ','Огарпунивание ПВХ');

UPDATE t_p45929761_bold_move_project.ai_prices
  SET calc_rule = 'perimeter*0.25'
  WHERE category = 'Ниши для штор';

UPDATE t_p45929761_bold_move_project.ai_prices
  SET calc_rule = 'const:1'
  WHERE category = 'Закладные';

UPDATE t_p45929761_bold_move_project.ai_prices
  SET calc_rule = 'const:1'
  WHERE name IN ('Блок питания 100 Вт','Блок питания 200 Вт','Блок питания 400 Вт');
