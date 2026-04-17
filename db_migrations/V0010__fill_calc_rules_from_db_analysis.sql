UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Считать по площади комнаты (м²). Количество = площадь',
  bundle = 'Автоматически добавить: Раскрой ПВХ (id=7) и Огарпунивание ПВХ (id=8) с тем же количеством м²'
WHERE id IN (1,2,3,4,5);

UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Считать по площади комнаты (м²). Количество = площадь. Раскрой и огарпунивание НЕ добавлять — тканевое полотно не требует'
WHERE id = 6;

UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Добавляется автоматически к любому ПВХ полотну. Количество = площадь полотна (м²). К тканевому полотну НЕ добавлять'
WHERE id IN (7, 8);

UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Считать по периметру комнаты (пм). Периметр = площадь × 1.3 если не указан клиентом. Если в смете есть теневой или парящий профиль — вычесть их длину из стандартного'
WHERE id IN (9, 10, 11);

UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Длину указывает клиент. Если не указана — уточни. Вычесть эту длину из стандартного профиля (стеновой алюминий)'
WHERE id IN (12, 13, 14);

UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Длину указывает клиент. Если не указана — уточни. Вычесть из стандартного профиля. Требует LED-ленту и блок питания — добавить в смету',
  bundle = 'Автоматически добавить: Лента QF Premium 5м (id=41) и подходящий Блок питания. Длина ленты = длина профиля, кратно 5м'
WHERE id IN (15, 16, 17);

UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Длину указывает клиент. Если не указана — взять 1/4 периметра по умолчанию (периметр ÷ 4)'
WHERE id IN (18, 19, 20, 21, 22, 23, 24, 25, 26, 27);

UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Длину указывает клиент. Если не указана — уточни у клиента'
WHERE id IN (28, 29);

UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Количество = количество светильников этого типа в смете. 1 закладная на 1 светильник'
WHERE id IN (30, 31, 32, 33, 34, 35);

UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Количество = количество вытяжек. Обычно 1 шт если клиент упомянул вытяжку'
WHERE id = 36;

UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Количество = количество люстр. Обычно 1 шт. Под люстру планка (id=38) — по умолчанию если тип не указан'
WHERE id IN (37, 38, 39);

UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Количество указывает клиент. Если не указано — уточни сколько светильников'
WHERE id = 40;

UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Длина ленты = длина парящего/теневого профиля с подсветкой. Кратно 5м — округлять вверх до ближайших 5м. Например нужно 6м → 2 катушки (10м)'
WHERE id IN (41, 42);

UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Количество = 1 шт. Мощность выбирается исходя из длины ленты: до 5м → 100Вт, до 10м → 200Вт, до 20м → 400Вт'
WHERE id IN (43, 44, 45);

UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Считать по площади полотна (м²). Для ПВХ — 350 ₽/м², для тканевого — 500 ₽/м²'
WHERE id IN (46, 47);

UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Считать по длине соответствующего профиля (пм). Стандартный = периметр минус теневой/парящий'
WHERE id IN (48, 49, 50);

UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Считать по длине ниши (пм)'
WHERE id IN (51, 52, 53, 54, 55, 56, 57, 58, 59);

UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Количество = общее число закладных в смете (люстры + светильники + вытяжки). 1 монтаж на 1 закладную'
WHERE id = 60;

UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Количество = количество точек освещения (светильники + люстры). 1 монтаж разводки на 1 точку. 1 точка = 1.5 пм провода'
WHERE id = 61;

UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Считать по длине LED-ленты (пм)'
WHERE id = 62;

UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Количество = количество блоков питания в смете. 1 монтаж на 1 блок'
WHERE id = 63;

UPDATE t_p45929761_bold_move_project.ai_prices SET
  calc_rule = 'Считать по длине ленты (пм). Добавляется если есть LED-лента'
WHERE id = 64;
