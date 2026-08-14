UPDATE t_p45929761_bold_move_project.touch_events
SET status = 'error'
WHERE channel = 'telegram' AND direction = 'out' AND status = 'pending'
  AND id IN (1979, 1980, 1981);