-- Заменяем текстовые правила ниш на машинные формулы
-- Текст для LLM остаётся в виде комментария в самой формуле через client_changes
UPDATE t_p45929761_bold_move_project.ai_prices
SET calc_rule = 'perimeter*0.25'
WHERE category = 'Ниши для штор'
  AND calc_rule ILIKE '%длину указывает клиент%';