ALTER TABLE t_p45929761_bold_move_project.channel_qr_sessions
    ADD COLUMN IF NOT EXISTS action VARCHAR(16) NOT NULL DEFAULT 'connect';
