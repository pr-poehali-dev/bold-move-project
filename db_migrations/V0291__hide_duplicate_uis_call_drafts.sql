UPDATE t_p45929761_bold_move_project.touch_events
SET status = 'hidden'
WHERE id IN (296, 298)
  AND channel = 'call'
  AND external_id IS NULL;