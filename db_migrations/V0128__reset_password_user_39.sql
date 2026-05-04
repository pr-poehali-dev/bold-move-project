-- Устанавливаем пароль 111111 (SHA-256: bcb15f821479b4d5772bd0ca866c00ad5f926e3580720659cc80d39c9d09802a)
UPDATE t_p45929761_bold_move_project.users 
SET password_hash = 'bcb15f821479b4d5772bd0ca866c00ad5f926e3580720659cc80d39c9d09802a'
WHERE id = 39 AND email = '111111@gmail.com';
