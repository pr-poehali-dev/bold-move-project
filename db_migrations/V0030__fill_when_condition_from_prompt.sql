-- Полотна ПВХ: when_condition + calc_rule
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Клиент выбрал это полотно',
  calc_rule = 'Площадь комнаты (м²). Количество = площадь'
WHERE id IN (1,2,3,4,5);

-- Тканевое полотно
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Клиент выбрал тканевое полотно',
  calc_rule = 'Площадь комнаты (м²). Количество = площадь'
WHERE id = 6;

-- Раскрой ПВХ
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Клиент выбрал любое ПВХ полотно (не тканевое). Добавляется автоматически.',
  calc_rule = 'Площадь полотна (м²). Количество = площадь комнаты'
WHERE id = 7;

-- Огарпунивание ПВХ
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Клиент выбрал любое ПВХ полотно (не тканевое). Добавляется автоматически.',
  calc_rule = 'Площадь полотна (м²). Количество = площадь комнаты'
WHERE id = 8;

-- Профиль стандартный (стеновой ПВХ, алюминий, потолочный)
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Добавляется всегда. Если в смете есть теневой или парящий профиль — вычесть их длину из стандартного.',
  calc_rule = 'Периметр комнаты (пм). Периметр = площадь × 1.3 если не указан клиентом. Минус длина теневого/парящего профиля если они есть.'
WHERE id IN (9,10,11);

-- Теневой профиль
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Клиент упомянул теневой профиль, теневую нишу или теневой зазор.',
  calc_rule = 'Длину указывает клиент. Если не указана — уточни у клиента. Вычесть эту длину из стандартного профиля.'
WHERE id IN (12,13,60);

-- Парящий профиль
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Клиент упомянул парящий профиль, световую линию или парящий потолок. По умолчанию без уточнения = Flexy FLY 02.',
  calc_rule = 'Длину указывает клиент. Если не указана — уточни. Вычесть из стандартного профиля. Добавить LED-ленту длиной = длина профиля (кратно 5м) и блок питания.'
WHERE id IN (15,16,17);

-- Ниши для штор
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Клиент упомянул карниз, нишу для шторы, штору или гардину.',
  calc_rule = 'Длину указывает клиент. Если не указана — взять 1 сторону комнаты (периметр ÷ 4).'
WHERE id IN (18,19,20,21,22,23,24,25,26,27,59);

-- Закладные под светильники
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Клиент упомянул точечный светильник, GX-53, вклейку или добавить светильник. 1 закладная = 1 светильник.',
  calc_rule = 'Количество = количество светильников этого типа. 1 закладная на 1 светильник.'
WHERE id IN (30,31,32);

-- Под накладной
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Клиент упомянул накладной светильник.',
  calc_rule = 'Количество = количество накладных светильников. 1 закладная на 1 светильник.'
WHERE id = 33;

-- Под люстру крюк
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Клиент явно указал крюк для люстры.',
  calc_rule = '1 штука на 1 люстру.'
WHERE id = 37;

-- Под люстру планка (по умолчанию)
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Клиент упомянул люстру без уточнения типа крепления — планка по умолчанию.',
  calc_rule = '1 штука на 1 люстру.'
WHERE id = 38;

-- Под вытяжку
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Клиент упомянул вытяжку.',
  calc_rule = '1 штука на 1 вытяжку. Обычно 1 шт.'
WHERE id = 36;

-- Нестандартная закладная
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Клиент упомянул нестандартный светильник или закладную.',
  calc_rule = '1 штука на 1 светильник.'
WHERE id = 35;

-- Светильник GX-53
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Клиент упомянул светильники GX-53 или точечные светильники.',
  calc_rule = 'Количество указывает клиент. Если не указано — уточни сколько светильников.'
WHERE id = 40;

-- Лента QF Premium
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Клиент упомянул подсветку, LED-ленту или парящий/световой профиль с подсветкой.',
  calc_rule = 'Длина ленты = длина профиля с подсветкой. Кратно 5м — округлять вверх. Например нужно 6м → 2 катушки (10м).'
WHERE id = 41;

-- Лента QF MIX
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Клиент упомянул подсветку, LED-ленту или парящий/световой профиль с подсветкой (альтернатива QF Premium).',
  calc_rule = 'Длина ленты = длина профиля с подсветкой. Кратно 5м — округлять вверх. Например нужно 6м → 2 катушки (10м).'
WHERE id = 42;

-- Монтаж полотна ПВХ
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Всегда при наличии ПВХ полотна в смете.',
  calc_rule = 'Площадь полотна (м²).'
WHERE id = 46;

-- Монтаж полотна ТКАНЬ
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Только при тканевом полотне. Вместо Раскроя и Огарпунивания.',
  calc_rule = 'Площадь полотна (м²).'
WHERE id = 47;

-- Монтаж профиля стандарт
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Всегда при наличии стандартного профиля в смете.',
  calc_rule = 'Длина стандартного профиля (пм).'
WHERE id = 48;

-- Монтаж теневого профиля
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'При наличии теневого профиля в смете.',
  calc_rule = 'Длина теневого профиля (пм).'
WHERE id = 49;

-- Монтаж парящего профиля
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'При наличии парящего профиля в смете.',
  calc_rule = 'Длина парящего профиля (пм).'
WHERE id = 50;

-- Монтаж закладной
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'При наличии любых закладных в смете.',
  calc_rule = 'Количество = сумма всех закладных в смете.'
WHERE id = 51;

-- Монтаж разводки ГОСТ 0.75
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Только если в смете есть точечные светильники GX-53. Если светильников нет — НЕ добавлять.',
  calc_rule = '1 точечный светильник = 1.5 пог.м разводки. Итого = количество светильников × 1.5'
WHERE id = 52;

-- Монтаж ленты
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'При наличии LED-ленты в смете.',
  calc_rule = 'Длина ленты (пм) = длина профиля с подсветкой.'
WHERE id = 53;

-- Монтаж блока питания
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'При наличии блока питания в смете.',
  calc_rule = '1 штука на каждый блок питания.'
WHERE id = 54;

-- Монтаж светильников GX-53
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'При наличии закладных под светильник ∅90 (GX-53) в смете.',
  calc_rule = 'Количество = количество закладных под GX-53.'
WHERE id = 56;

-- Работы на высоте до 4м
UPDATE t_p45929761_bold_move_project.ai_prices SET
  when_condition = 'Клиент упомянул что высота потолков более 3м или указал "высота имеется частями".',
  calc_rule = '1 штука (фиксированно).'
WHERE id = 61;