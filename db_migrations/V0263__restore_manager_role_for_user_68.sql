-- Восстанавливаем роль сотрудника Артёма Дудина (id=68), случайно сброшенную на 'client'
-- через баг в форме профиля. company_id и permissions не были затронуты багом — трогаем только role/approved/discount.
UPDATE t_p45929761_bold_move_project.users
SET role = 'manager', approved = TRUE, discount = 0, updated_at = NOW()
WHERE id = 68 AND email = 'revadicc@gmail.com';