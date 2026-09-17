ALTER TABLE t_p45929761_bold_move_project.leakad_comments
    ADD COLUMN IF NOT EXISTS live_message_id INTEGER;

ALTER TABLE t_p45929761_bold_move_project.leakad_events
    ADD COLUMN IF NOT EXISTS replayed_at TIMESTAMPTZ;

ALTER TABLE t_p45929761_bold_move_project.leakad_entities
    ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ;
