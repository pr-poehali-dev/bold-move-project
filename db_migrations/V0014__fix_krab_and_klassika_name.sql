-- Удаляем "Краб" — такой позиции нет в прайсе
UPDATE t_p45929761_bold_move_project.ai_prices SET active = false WHERE id = 64;

-- Переименовываем теневой классик чтобы LLM точно нашёл по слову "классик"
UPDATE t_p45929761_bold_move_project.ai_prices
SET name = 'Теневой классик (Flexy KLASSIKA 140)'
WHERE id = 60;
