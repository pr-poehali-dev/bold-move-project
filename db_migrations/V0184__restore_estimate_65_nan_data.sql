UPDATE t_p45929761_bold_move_project.saved_estimates
SET
  blocks = '[
    {"title":"Зал","numbered":false,"items":[{"name":"EuroKRAAB стеновой","value":"10 пог.м × 2200 ₽ = 22 000 ₽"}]},
    {"title":"Зал","numbered":false,"items":[{"name":"Flexy FLY 02  с рассеивателем","value":"4 пог.м × 1650 ₽ = 6 600 ₽"}]}
  ]'::jsonb,
  totals = '["Econom: 24 310 ₽","Standard: 28 600 ₽","Premium: 36 322 ₽"]'::jsonb,
  total_econom = 24310,
  total_standard = 28600,
  total_premium = 36322,
  updated_at = NOW()
WHERE id = 65;