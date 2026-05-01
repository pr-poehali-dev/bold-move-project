-- Исправляем demo-компании: убираем agent_purchased_at, ставим trial_until на 14 дней от даты создания
UPDATE t_p45929761_bold_move_project.users
SET 
  trial_until = agent_purchased_at + INTERVAL '14 days',
  agent_purchased_at = NULL
WHERE role = 'company'
  AND email LIKE 'demo-%'
  AND agent_purchased_at IS NOT NULL
  AND trial_until IS NULL;