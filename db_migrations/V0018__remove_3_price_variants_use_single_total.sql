UPDATE t_p45929761_bold_move_project.ai_system_prompt
SET content = replace(content,
  'Итоговая стоимость — 3 варианта:
Econom: X ₽
Standard: X ₽
Premium: X ₽',
  'Итоговая стоимость — одна сумма (сложи все позиции):
ИТОГО: X ₽'
)
WHERE id = 1;
