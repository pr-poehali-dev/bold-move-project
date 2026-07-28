-- Модуль «Касания + Аналитика»: 4 таблицы с префиксом touch_
-- Ключ склейки клиента — номер телефона (нормализованный).

-- 1. Клиенты модуля касаний
CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.touch_clients (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    phone VARCHAR(32),
    name VARCHAR(255),
    crm_contact_id INTEGER,
    state_summary TEXT,
    next_action TEXT,
    interest VARCHAR(16),
    stage VARCHAR(64),
    analysis_updated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_touch_clients_company ON t_p45929761_bold_move_project.touch_clients (company_id);
CREATE INDEX IF NOT EXISTS idx_touch_clients_phone   ON t_p45929761_bold_move_project.touch_clients (phone);
CREATE UNIQUE INDEX IF NOT EXISTS uq_touch_clients_company_phone
    ON t_p45929761_bold_move_project.touch_clients (company_id, phone)
    WHERE phone IS NOT NULL;

-- 2. Единая лента касаний (звонки + сообщения всех каналов)
CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.touch_events (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL
        REFERENCES t_p45929761_bold_move_project.touch_clients (id),
    channel VARCHAR(32) NOT NULL,
    direction VARCHAR(8) NOT NULL,
    external_id VARCHAR(255),
    text TEXT,
    audio_url TEXT,
    duration_sec INTEGER,
    attachments JSONB,
    status VARCHAR(32) DEFAULT 'received',
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_touch_events_client  ON t_p45929761_bold_move_project.touch_events (client_id);
CREATE INDEX IF NOT EXISTS idx_touch_events_created ON t_p45929761_bold_move_project.touch_events (created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_touch_events_channel_ext
    ON t_p45929761_bold_move_project.touch_events (channel, external_id)
    WHERE external_id IS NOT NULL;

-- 3. Детальные транскрипты звонков
CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.touch_call_transcripts (
    id SERIAL PRIMARY KEY,
    touch_id INTEGER
        REFERENCES t_p45929761_bold_move_project.touch_events (id),
    comm_id VARCHAR(255) UNIQUE,
    full_text TEXT,
    replicas JSONB,
    replica_count INTEGER DEFAULT 0,
    operator_replicas INTEGER DEFAULT 0,
    client_replicas INTEGER DEFAULT 0,
    has_ivr BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_touch_transcripts_touch ON t_p45929761_bold_move_project.touch_call_transcripts (touch_id);

-- 4. История ИИ-анализов по клиенту
CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.touch_client_analyses (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL
        REFERENCES t_p45929761_bold_move_project.touch_clients (id),
    state_summary TEXT,
    next_action TEXT,
    interest VARCHAR(16),
    interest_label VARCHAR(64),
    stage VARCHAR(64),
    outcome VARCHAR(16),
    outcome_label VARCHAR(64),
    risks JSONB,
    key_points JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_touch_analyses_client ON t_p45929761_bold_move_project.touch_client_analyses (client_id);