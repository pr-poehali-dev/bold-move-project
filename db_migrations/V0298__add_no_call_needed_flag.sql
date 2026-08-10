ALTER TABLE t_p45929761_bold_move_project.live_chats
  ADD COLUMN IF NOT EXISTS no_call_needed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN t_p45929761_bold_move_project.live_chats.no_call_needed IS
  'Менеджер отметил при закрытии карточки, что звонить клиенту больше не нужно (заменяет next_call_date)';
