ALTER TABLE t_p45929761_bold_move_project.live_chats ADD COLUMN IF NOT EXISTS phone text NULL;
ALTER TABLE t_p45929761_bold_move_project.live_chats ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';
ALTER TABLE t_p45929761_bold_move_project.live_chats ADD COLUMN IF NOT EXISTS measure_date timestamp with time zone NULL;
ALTER TABLE t_p45929761_bold_move_project.live_chats ADD COLUMN IF NOT EXISTS notes text NULL;
ALTER TABLE t_p45929761_bold_move_project.live_chats ADD COLUMN IF NOT EXISTS address text NULL;
ALTER TABLE t_p45929761_bold_move_project.live_chats ADD COLUMN IF NOT EXISTS area numeric(10,2) NULL;
ALTER TABLE t_p45929761_bold_move_project.live_chats ADD COLUMN IF NOT EXISTS budget numeric(12,2) NULL;
ALTER TABLE t_p45929761_bold_move_project.live_chats ADD COLUMN IF NOT EXISTS source text NULL DEFAULT 'chat';
