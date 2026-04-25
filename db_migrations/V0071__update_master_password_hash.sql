-- Устанавливаем пароль Sdauxbasstre228 (sha256) для мастер-аккаунта
UPDATE t_p45929761_bold_move_project.users
SET password_hash = encode(sha256('Sdauxbasstre228'::bytea), 'hex')
WHERE id = 2;
