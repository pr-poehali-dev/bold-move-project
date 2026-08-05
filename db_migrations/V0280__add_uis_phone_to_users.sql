ALTER TABLE t_p45929761_bold_move_project.users
  ADD COLUMN IF NOT EXISTS uis_phone TEXT;

COMMENT ON COLUMN t_p45929761_bold_move_project.users.uis_phone IS
  'Номер сотрудника (оператора) в системе телефонии UIS — используется для click-to-call';