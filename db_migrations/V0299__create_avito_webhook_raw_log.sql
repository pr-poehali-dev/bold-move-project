CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.avito_webhook_raw_log (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NULL,
    msg_type VARCHAR(64) NULL,
    chat_id VARCHAR(128) NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT false,
    error TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avito_webhook_raw_log_created_at
    ON t_p45929761_bold_move_project.avito_webhook_raw_log (created_at DESC);
