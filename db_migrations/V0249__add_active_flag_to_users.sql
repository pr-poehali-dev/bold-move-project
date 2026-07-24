-- Поле active: включён ли сотрудник. По умолчанию true (все текущие остаются активными).
-- Если false — сотрудник не может выполнять действия, пока админ компании/мастер не включит.
ALTER TABLE t_p45929761_bold_move_project.users
ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;