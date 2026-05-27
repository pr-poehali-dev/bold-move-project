CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.wl_manager_sessions (
    id         SERIAL PRIMARY KEY,
    manager_id INTEGER NOT NULL REFERENCES t_p45929761_bold_move_project.wl_managers(id),
    token      TEXT    NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);