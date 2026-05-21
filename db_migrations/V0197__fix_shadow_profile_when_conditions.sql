
UPDATE t_p45929761_bold_move_project.ai_prices
SET when_condition = 'ТОЛЬКО если клиент явно сказал "потолочный еврокраб", "потолочный EuroKRAAB" или "потолочный теневой". Это НЕ профиль по умолчанию. По умолчанию всегда EuroKRAAB стеновой.'
WHERE name = 'EuroKRAAB потолочный';

UPDATE t_p45929761_bold_move_project.ai_prices
SET when_condition = 'ПРОФИЛЬ ПО УМОЛЧАНИЮ для теневого зазора. Добавлять всегда когда клиент упомянул "теневой", "теневой профиль", "еврокраб", "краб" — и НЕ сказал явно "потолочный". Это самый частый вариант.'
WHERE name = 'EuroKRAAB стеновой';

UPDATE t_p45929761_bold_move_project.ai_prices
SET when_condition = 'ТОЛЬКО если клиент явно написал "классик", "классика", "флекси классика", "KLASSIKA". Это НЕ профиль по умолчанию.'
WHERE name = 'Теневой классик (Flexy KLASSIKA 140)';
