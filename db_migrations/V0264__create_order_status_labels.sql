CREATE TABLE IF NOT EXISTS order_status_labels (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    status VARCHAR(64) NOT NULL,
    label VARCHAR(128),
    color VARCHAR(16),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, status)
);

CREATE INDEX IF NOT EXISTS idx_order_status_labels_company ON order_status_labels (company_id);
