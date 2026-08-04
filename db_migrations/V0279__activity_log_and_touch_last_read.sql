-- Баг 4: общий журнал активности по клиенту (виден всем сотрудникам компании, с автором).
-- Раньше лог хранился только в localStorage браузера → автор недоступен, коллеги не видели.
CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.activity_log (
    id          SERIAL PRIMARY KEY,
    client_id   INTEGER NOT NULL,
    company_id  INTEGER,
    user_id     INTEGER,
    user_name   VARCHAR(255),
    icon        VARCHAR(64),
    color       VARCHAR(16),
    text        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_client
    ON t_p45929761_bold_move_project.activity_log (client_id, created_at);

-- Баг 5: общая на компанию отметка "прочитано" для касаний.
-- Раньше отметка хранилась в localStorage каждого сотрудника → счётчик у всех разный.
-- last_read_at общий для диалога: прочитал один сотрудник — считается прочитанным у всех.
ALTER TABLE t_p45929761_bold_move_project.touch_clients
    ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;