-- Таблица менеджеров whitelabel
CREATE TABLE t_p45929761_bold_move_project.wl_managers (
    id           SERIAL PRIMARY KEY,
    email        TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    wl_role      TEXT NOT NULL DEFAULT 'manager', -- 'manager' | 'master_manager'
    approved     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Назначение менеджера на компанию
ALTER TABLE t_p45929761_bold_move_project.demo_companies
    ADD COLUMN manager_id INTEGER NULL REFERENCES t_p45929761_bold_move_project.wl_managers(id);

-- Индекс для быстрой выборки компаний по менеджеру
CREATE INDEX idx_demo_companies_manager ON t_p45929761_bold_move_project.demo_companies(manager_id);
