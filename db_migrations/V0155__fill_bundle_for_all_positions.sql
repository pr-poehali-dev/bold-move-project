-- Заполняем bundle для всех позиций по логике правил

-- Парящие профили: лента + все блоки питания (код выберет нужный) + монтаж парящего + монтаж ленты + монтаж блока
UPDATE ai_prices SET bundle = '[41, 43, 44, 45, 50, 53, 54]' WHERE id IN (15, 16, 17);

-- Лента QF Premium и MIX: монтаж ленты + все блоки питания + монтаж блока
UPDATE ai_prices SET bundle = '[53, 43, 44, 45, 54]' WHERE id IN (41, 42);

-- Блоки питания: монтаж блока питания
UPDATE ai_prices SET bundle = '[54]' WHERE id IN (43, 44, 45);

-- Светильник GX-53: закладная ∅90 + монтаж светильника + монтаж разводки ГОСТ
UPDATE ai_prices SET bundle = '[30, 56, 52]' WHERE id = 40;

-- Закладные под светильники: монтаж закладной
UPDATE ai_prices SET bundle = '[51]' WHERE id IN (30, 31, 32, 33, 34, 35);

-- Закладная под вытяжку: монтаж закладной
UPDATE ai_prices SET bundle = '[51]' WHERE id IN (36, 70);

-- Закладные под люстру: монтаж закладной
UPDATE ai_prices SET bundle = '[51]' WHERE id IN (37, 38, 39);

-- Ниши для штор: монтаж ниши
UPDATE ai_prices SET bundle = '[73]' WHERE id IN (18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 59);
