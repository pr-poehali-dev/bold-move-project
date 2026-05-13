-- Деактивируем лишние активные варианты у комнаты 3, оставляем только последний (id=3)
UPDATE t_p45929761_bold_move_project.plan_variants
SET is_active = false
WHERE room_id = 3 AND is_active = true AND id != 3;