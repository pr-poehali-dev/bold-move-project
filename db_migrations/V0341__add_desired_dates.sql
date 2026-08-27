-- Разделение дат замера/монтажа на "желаемые" (ставит 1 линия со слов клиента,
-- пока точное время не согласовано) и "фактические" (существующие measure_date/
-- install_date — подтверждает 2 линия/замерщик/монтажник после согласования).
ALTER TABLE t_p45929761_bold_move_project.live_chats
  ADD COLUMN IF NOT EXISTS desired_measure_date  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS desired_install_date  TIMESTAMPTZ;