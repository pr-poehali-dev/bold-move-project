CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.leakad_events (
    id                 BIGSERIAL PRIMARY KEY,
    event_id           TEXT NOT NULL,
    account_id         TEXT,
    event_type         TEXT,
    event_version      INTEGER,
    transaction_id     TEXT,
    entity_type        TEXT,
    entity_id          TEXT,
    entity_updated_at  TIMESTAMPTZ,
    sequence_no        BIGINT,
    occurred_at        TIMESTAMPTZ,
    sent_at            TIMESTAMPTZ,
    received_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at       TIMESTAMPTZ,
    body_sha256        TEXT,
    payload            JSONB NOT NULL DEFAULT '{}'::jsonb,
    outcome            TEXT NOT NULL DEFAULT 'pending',
    http_status        INTEGER,
    internal_entity_id INTEGER,
    attempts           INTEGER NOT NULL DEFAULT 1,
    error              TEXT,
    is_duplicate       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS leakad_events_event_id_uk
    ON t_p45929761_bold_move_project.leakad_events (COALESCE(account_id, '-'), event_id);
CREATE INDEX IF NOT EXISTS leakad_events_seq_idx
    ON t_p45929761_bold_move_project.leakad_events (COALESCE(account_id, '-'), sequence_no);
CREATE INDEX IF NOT EXISTS leakad_events_outcome_idx
    ON t_p45929761_bold_move_project.leakad_events (outcome, received_at DESC);
CREATE INDEX IF NOT EXISTS leakad_events_entity_idx
    ON t_p45929761_bold_move_project.leakad_events (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.leakad_entities (
    id                 BIGSERIAL PRIMARY KEY,
    account_id         TEXT NOT NULL DEFAULT '-',
    entity_type        TEXT NOT NULL,
    external_id        TEXT NOT NULL,
    internal_id        INTEGER,
    internal_table     TEXT,
    parent_lead_ext    TEXT,
    parent_contact_ext TEXT,
    entity_updated_at  TIMESTAMPTZ,
    last_sequence      BIGINT,
    is_removed         BOOLEAN NOT NULL DEFAULT FALSE,
    removed_at         TIMESTAMPTZ,
    merged_into        TEXT,
    data               JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_snapshot       JSONB NOT NULL DEFAULT '{}'::jsonb,
    record_sha256      TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS leakad_entities_uk
    ON t_p45929761_bold_move_project.leakad_entities (account_id, entity_type, external_id);
CREATE INDEX IF NOT EXISTS leakad_entities_internal_idx
    ON t_p45929761_bold_move_project.leakad_entities (entity_type, internal_id);
CREATE INDEX IF NOT EXISTS leakad_entities_lead_idx
    ON t_p45929761_bold_move_project.leakad_entities (parent_lead_ext);

CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.leakad_dictionaries (
    id           BIGSERIAL PRIMARY KEY,
    account_id   TEXT NOT NULL DEFAULT '-',
    dict_type    TEXT NOT NULL,
    external_id  TEXT NOT NULL,
    name         TEXT,
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    is_removed   BOOLEAN NOT NULL DEFAULT FALSE,
    data         JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS leakad_dictionaries_uk
    ON t_p45929761_bold_move_project.leakad_dictionaries (account_id, dict_type, external_id);

CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.leakad_status_map (
    id                 BIGSERIAL PRIMARY KEY,
    external_key       TEXT NOT NULL,
    internal_status    TEXT NOT NULL,
    internal_substatus TEXT,
    note               TEXT,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS leakad_status_map_uk
    ON t_p45929761_bold_move_project.leakad_status_map (lower(external_key));

INSERT INTO t_p45929761_bold_move_project.leakad_status_map (external_key, internal_status, note) VALUES
    ('new',                'new',              'Новая заявка'),
    ('новая',              'new',              'Новая заявка'),
    ('call',               'call',             'Прозвон'),
    ('прозвон',            'call',             'Прозвон'),
    ('в работе',           'call',             'В работе'),
    ('measure',            'measure',          'Назначен замер'),
    ('назначен замер',     'measure',          'Назначен замер'),
    ('замер',              'measure',          'Назначен замер'),
    ('measured',           'measured',         'Замер выполнен'),
    ('замер выполнен',     'measured',         'Замер выполнен'),
    ('contract',           'contract',         'Договор'),
    ('договор',            'contract',         'Договор'),
    ('prepaid',            'prepaid',          'Предоплата'),
    ('предоплата',         'prepaid',          'Предоплата'),
    ('install_scheduled',  'install_scheduled','Монтаж назначен'),
    ('монтаж назначен',    'install_scheduled','Монтаж назначен'),
    ('install_done',       'install_done',     'Монтаж выполнен'),
    ('монтаж выполнен',    'install_done',     'Монтаж выполнен'),
    ('done',               'done',             'Завершено'),
    ('завершено',          'done',             'Завершено'),
    ('успешно',            'done',             'Завершено'),
    ('cancelled',          'cancelled',        'Отказ'),
    ('отказ',              'cancelled',        'Отказ'),
    ('отменено',           'cancelled',        'Отказ')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.leakad_comments (
    id             BIGSERIAL PRIMARY KEY,
    account_id     TEXT NOT NULL DEFAULT '-',
    external_id    TEXT NOT NULL,
    lead_ext_id    TEXT,
    contact_ext_id TEXT,
    client_id      INTEGER,
    direction      TEXT,
    channel        TEXT,
    author_type    TEXT,
    author_ext_id  TEXT,
    author_name    TEXT,
    text           TEXT,
    attachments    JSONB NOT NULL DEFAULT '[]'::jsonb,
    occurred_at    TIMESTAMPTZ,
    updated_at     TIMESTAMPTZ,
    is_removed     BOOLEAN NOT NULL DEFAULT FALSE,
    removed_at     TIMESTAMPTZ,
    raw_snapshot   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS leakad_comments_uk
    ON t_p45929761_bold_move_project.leakad_comments (account_id, external_id);
CREATE INDEX IF NOT EXISTS leakad_comments_client_idx
    ON t_p45929761_bold_move_project.leakad_comments (client_id, occurred_at);

CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.leakad_tasks (
    id                 BIGSERIAL PRIMARY KEY,
    account_id         TEXT NOT NULL DEFAULT '-',
    external_id        TEXT NOT NULL,
    lead_ext_id        TEXT,
    client_id          INTEGER,
    calendar_event_id  INTEGER,
    task_type          TEXT,
    text               TEXT,
    responsible_ext_id TEXT,
    due_at             TIMESTAMPTZ,
    completed          BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at       TIMESTAMPTZ,
    occurred_at        TIMESTAMPTZ,
    updated_at         TIMESTAMPTZ,
    is_removed         BOOLEAN NOT NULL DEFAULT FALSE,
    raw_snapshot       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS leakad_tasks_uk
    ON t_p45929761_bold_move_project.leakad_tasks (account_id, external_id);
CREATE INDEX IF NOT EXISTS leakad_tasks_client_idx
    ON t_p45929761_bold_move_project.leakad_tasks (client_id, due_at);

CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.leakad_files (
    id             BIGSERIAL PRIMARY KEY,
    account_id     TEXT NOT NULL DEFAULT '-',
    external_id    TEXT NOT NULL,
    lead_ext_id    TEXT,
    comment_ext_id TEXT,
    client_id      INTEGER,
    client_file_id INTEGER,
    name           TEXT,
    mime_type      TEXT,
    size_bytes     BIGINT,
    sha256         TEXT,
    download_url   TEXT,
    stored_url     TEXT,
    fetch_status   TEXT NOT NULL DEFAULT 'pending',
    fetch_error    TEXT,
    occurred_at    TIMESTAMPTZ,
    is_removed     BOOLEAN NOT NULL DEFAULT FALSE,
    raw_snapshot   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS leakad_files_uk
    ON t_p45929761_bold_move_project.leakad_files (account_id, external_id);
CREATE INDEX IF NOT EXISTS leakad_files_client_idx
    ON t_p45929761_bold_move_project.leakad_files (client_id);

CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.leakad_payments (
    id           BIGSERIAL PRIMARY KEY,
    account_id   TEXT NOT NULL DEFAULT '-',
    external_id  TEXT NOT NULL,
    lead_ext_id  TEXT,
    client_id    INTEGER,
    kind         TEXT,
    amount       NUMERIC(14,2),
    currency     TEXT NOT NULL DEFAULT 'RUB',
    paid_at      TIMESTAMPTZ,
    is_removed   BOOLEAN NOT NULL DEFAULT FALSE,
    raw_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS leakad_payments_uk
    ON t_p45929761_bold_move_project.leakad_payments (account_id, external_id);

CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.leakad_snapshots (
    id            BIGSERIAL PRIMARY KEY,
    account_id    TEXT NOT NULL DEFAULT '-',
    snapshot_at   TIMESTAMPTZ NOT NULL,
    source_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_hashes JSONB NOT NULL DEFAULT '{}'::jsonb,
    local_counts  JSONB NOT NULL DEFAULT '{}'::jsonb,
    local_hashes  JSONB NOT NULL DEFAULT '{}'::jsonb,
    matched       BOOLEAN,
    report        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE t_p45929761_bold_move_project.live_chats
    ADD COLUMN IF NOT EXISTS leakad_lead_id TEXT;
CREATE INDEX IF NOT EXISTS live_chats_leakad_lead_idx
    ON t_p45929761_bold_move_project.live_chats (leakad_lead_id);
