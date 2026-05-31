-- Создаём запись в live_chats для тестовой карточки "Тест заявка" из построителя
INSERT INTO t_p45929761_bold_move_project.live_chats
  (session_id, client_name, phone, address, status, source, company_id, project_id)
SELECT
  'plan-test-1',
  pp.client_name,
  pp.phone,
  pp.address,
  'new',
  'plan',
  2,
  pp.id
FROM t_p45929761_bold_move_project.plan_projects pp
WHERE pp.id = 10
  AND NOT EXISTS (
    SELECT 1 FROM t_p45929761_bold_move_project.live_chats
    WHERE session_id = 'plan-test-1'
  );

-- Привязываем kanban-карточку (id=8) к созданному live_chats клиенту
UPDATE t_p45929761_bold_move_project.kanban_cards
SET client_id = (
  SELECT id FROM t_p45929761_bold_move_project.live_chats
  WHERE session_id = 'plan-test-1' LIMIT 1
)
WHERE id = 8 AND company_id = 2;
