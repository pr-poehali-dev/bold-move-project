-- Дата следующего звонка — заполняется вручную сотрудником в блоке "Касания"
-- карточки клиента (напоминание для повторного созвона).
ALTER TABLE t_p45929761_bold_move_project.live_chats
  ADD COLUMN IF NOT EXISTS next_call_date timestamp with time zone NULL;