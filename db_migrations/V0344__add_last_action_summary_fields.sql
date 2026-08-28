ALTER TABLE t_p45929761_bold_move_project.live_chats
  ADD COLUMN IF NOT EXISTS last_action_summary text,
  ADD COLUMN IF NOT EXISTS last_action_summary_at timestamp,
  ADD COLUMN IF NOT EXISTS last_action_analyzed_for timestamp;

COMMENT ON COLUMN t_p45929761_bold_move_project.live_chats.last_action_summary IS 'ИИ-сводка последнего действия по заявке (напр. "Написали клиенту о сроках — ответа нет 3 дня")';
COMMENT ON COLUMN t_p45929761_bold_move_project.live_chats.last_action_summary_at IS 'Когда ИИ-сводка последнего действия была посчитана';
COMMENT ON COLUMN t_p45929761_bold_move_project.live_chats.last_action_analyzed_for IS 'На какой момент last_activity_at была построена сводка — если last_activity_at ушёл вперёд, сводка устарела и пересчитывается';
