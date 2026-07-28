ALTER TABLE t_p45929761_bold_move_project.touch_call_transcripts
    ADD COLUMN IF NOT EXISTS call_type VARCHAR(64),
    ADD COLUMN IF NOT EXISTS call_type_label VARCHAR(128),
    ADD COLUMN IF NOT EXISTS qualification VARCHAR(64),
    ADD COLUMN IF NOT EXISTS qualification_label VARCHAR(128),
    ADD COLUMN IF NOT EXISTS client_interest VARCHAR(16),
    ADD COLUMN IF NOT EXISTS client_interest_label VARCHAR(64),
    ADD COLUMN IF NOT EXISTS outcome VARCHAR(16),
    ADD COLUMN IF NOT EXISTS outcome_label VARCHAR(64),
    ADD COLUMN IF NOT EXISTS fail_reason TEXT,
    ADD COLUMN IF NOT EXISTS success_factor TEXT,
    ADD COLUMN IF NOT EXISTS operator_score INTEGER,
    ADD COLUMN IF NOT EXISTS operator_followed_script BOOLEAN,
    ADD COLUMN IF NOT EXISTS operator_handled_objections BOOLEAN,
    ADD COLUMN IF NOT EXISTS operator_comment TEXT,
    ADD COLUMN IF NOT EXISTS summary TEXT,
    ADD COLUMN IF NOT EXISTS key_phrases_client JSONB,
    ADD COLUMN IF NOT EXISTS key_phrases_operator JSONB,
    ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_touch_transcripts_score
    ON t_p45929761_bold_move_project.touch_call_transcripts (operator_score);
