CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.channel_qr_sessions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    channel VARCHAR(16) NOT NULL,          -- 'telegram' | 'max' (на будущее)
    status VARCHAR(16) NOT NULL DEFAULT 'pending',  -- pending -> qr_ready -> connected | expired | error
    qr_url TEXT NULL,                       -- tg://login?token=... — воркер кладёт сюда
    account_name VARCHAR(255) NULL,         -- имя/телефон аккаунта после успешного входа
    error TEXT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE(company_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_channel_qr_sessions_status
    ON t_p45929761_bold_move_project.channel_qr_sessions (status);
