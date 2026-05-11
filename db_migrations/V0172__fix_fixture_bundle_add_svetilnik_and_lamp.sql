-- Закладная ∅90 → bundle добавляет: Монтаж закладной + Светильник GX-53 + Лампа GX-53 + Монтаж светильников
UPDATE t_p45929761_bold_move_project.ai_prices
SET bundle = '[51, 40, 74, 56]'
WHERE id = 30;

-- Светильник GX-53 → убираем закладную из bundle (чтобы не дублировалась если пришла из закладной)
UPDATE t_p45929761_bold_move_project.ai_prices
SET bundle = '[56, 52]'
WHERE id = 40;