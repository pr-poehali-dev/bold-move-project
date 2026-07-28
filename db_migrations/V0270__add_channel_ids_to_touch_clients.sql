ALTER TABLE t_p45929761_bold_move_project.touch_clients
    ADD COLUMN IF NOT EXISTS channel_ids JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_touch_clients_channel_ids
    ON t_p45929761_bold_move_project.touch_clients USING gin (channel_ids);
