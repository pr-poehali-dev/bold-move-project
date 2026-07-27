UPDATE t_p45929761_bold_move_project.live_chats
SET created_via = 'manual'
WHERE session_id LIKE 'manual\_%'
  AND created_via IS DISTINCT FROM 'manual';

UPDATE t_p45929761_bold_move_project.live_chats
SET created_via = 'plan'
WHERE session_id LIKE 'plan-%'
  AND created_via IS DISTINCT FROM 'plan';

ALTER TABLE t_p45929761_bold_move_project.live_chats
  ALTER COLUMN created_via SET DEFAULT NULL;
