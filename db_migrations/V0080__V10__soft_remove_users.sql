ALTER TABLE t_p45929761_bold_move_project.users ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP;
ALTER TABLE t_p45929761_bold_move_project.users ADD COLUMN IF NOT EXISTS removed_name TEXT;
ALTER TABLE t_p45929761_bold_move_project.users ADD COLUMN IF NOT EXISTS removed_email TEXT;