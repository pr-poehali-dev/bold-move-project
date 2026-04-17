UPDATE t_p45929761_bold_move_project.ai_system_prompt
SET content = replace(content,
  'Итоговая стоимость — одна сумма (сложи все позиции):
ИТОГО: X ₽',
  'Итоговая стоимость — 3 варианта (считай математически точно из позиций выше):
Econom:   X ₽  (Standard × 0.77)
Standard: X ₽  (сумма всех позиций)
Premium:  X ₽  (Standard × 1.27)'
)
WHERE id = 1;
