-- Исправление: привязываем Google-вход сотрудника Алексея Чумакова (id=60, MosPotolki)
-- к его правильному рабочему аккаунту вместо случайно созданного дубля (id=73).
-- Дубль не удаляем физически (защита данных) — помечаем как удалённый (removed_at)
-- и снимаем google_id, чтобы он больше не участвовал во входе.
-- Бэкап дубля: id=73, email=a89134126782@gmail.com, google_id=111149787868891508743,
-- role=installer, company_id=NULL, created_at=2026-08-06 09:44:04

UPDATE t_p45929761_bold_move_project.users
SET google_id = '111149787868891508743'
WHERE id = 60;

UPDATE t_p45929761_bold_move_project.users
SET removed_at = NOW(), google_id = NULL
WHERE id = 73;