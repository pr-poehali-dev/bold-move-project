CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.integrations (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL UNIQUE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integrations_company_id
    ON t_p45929761_bold_move_project.integrations (company_id);