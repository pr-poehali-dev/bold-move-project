-- Состояние активной вытяжки истории из LeakAD (Контур A, pull-режим).
-- Нужно, чтобы переносить историю НЕ дожидаясь, пока LeakAD сам её перешлёт:
-- мы сами обходим их API экспорта постранично и можем продолжить с места
-- обрыва (курсор сохраняется), т.к. облачная функция ограничена по времени.
CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.leakad_pull_jobs (
    id            BIGSERIAL PRIMARY KEY,
    account_id    TEXT NOT NULL DEFAULT '-',
    entity        TEXT NOT NULL,
    source        TEXT NOT NULL DEFAULT 'api',
    snapshot_at   TIMESTAMPTZ,
    cursor        TEXT,
    page_no       INTEGER NOT NULL DEFAULT 0,
    fetched       INTEGER NOT NULL DEFAULT 0,
    imported      INTEGER NOT NULL DEFAULT 0,
    failed        INTEGER NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'pending',
    last_error    TEXT,
    errors        JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at   TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS leakad_pull_jobs_uk
    ON t_p45929761_bold_move_project.leakad_pull_jobs (account_id, entity, source);
CREATE INDEX IF NOT EXISTS leakad_pull_jobs_status_idx
    ON t_p45929761_bold_move_project.leakad_pull_jobs (status, updated_at DESC);
