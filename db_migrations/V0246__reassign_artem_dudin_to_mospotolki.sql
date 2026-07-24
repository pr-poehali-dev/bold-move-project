-- Перепривязка сотрудника Артём Дудин (id=68) к компании MosPotolki (id=8)
-- Ранее он был привязан к удалённой компании "Алексей" (id=60)
UPDATE t_p45929761_bold_move_project.users
SET company_id = 8
WHERE id = 68 AND email = 'revadicc@gmail.com';