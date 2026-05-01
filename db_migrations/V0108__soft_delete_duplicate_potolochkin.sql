-- Помечаем дубль potolochkin.ru (demo_id=8) как удалённый
UPDATE t_p45929761_bold_move_project.users SET removed_at = NOW() WHERE id = 24;
