-- Разделение дат замера/монтажа на "желаемые" (ставит 1 линия при первом контакте,
-- ещё не согласовано со специалистом) и "фактические" (measure_date/install_date —
-- уже существуют, ставит 2 линия после согласования).
ALTER TABLE t_p45929761_bold_move_project.live_chats
  ADD COLUMN IF NOT EXISTS desired_measure_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS desired_install_date TIMESTAMPTZ;