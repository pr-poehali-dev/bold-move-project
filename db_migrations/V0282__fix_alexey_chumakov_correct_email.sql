-- Исправление: правильный email Алексея Чумакова (MosPotolki, менеджер) — a89134126782@gmail.com
-- Ранее этот email был у случайно созданного дубля (id=73, уже помечен removed_at).
-- Переносим email на рабочий аккаунт (id=60), с дубля email снимаем во избежание конфликта уникальности.
-- Бэкап предыдущего состояния: id=60 email был a891341267802@gmail.com; id=73 email был a89134126782@gmail.com

UPDATE t_p45929761_bold_move_project.users
SET email = 'removed_73_' || email
WHERE id = 73;

UPDATE t_p45929761_bold_move_project.users
SET email = 'a89134126782@gmail.com'
WHERE id = 60;