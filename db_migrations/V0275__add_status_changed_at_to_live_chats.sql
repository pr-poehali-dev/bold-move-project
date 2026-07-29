ALTER TABLE t_p45929761_bold_move_project.live_chats
    ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP WITH TIME ZONE;

UPDATE t_p45929761_bold_move_project.live_chats
SET status_changed_at = COALESCE(updated_at, created_at, NOW())
WHERE status_changed_at IS NULL;