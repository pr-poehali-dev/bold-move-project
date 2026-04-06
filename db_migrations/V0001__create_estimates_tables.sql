
CREATE TABLE estimates (
    id SERIAL PRIMARY KEY,
    client_name VARCHAR(255),
    client_phone VARCHAR(50),
    client_comment TEXT DEFAULT '',
    status VARCHAR(30) DEFAULT 'new',
    tier VARCHAR(20) DEFAULT 'standard',
    total_econom NUMERIC(12,2) DEFAULT 0,
    total_standard NUMERIC(12,2) DEFAULT 0,
    total_premium NUMERIC(12,2) DEFAULT 0,
    discount_percent NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE estimate_items (
    id SERIAL PRIMARY KEY,
    estimate_id INTEGER NOT NULL,
    category VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    unit VARCHAR(20) DEFAULT 'шт',
    quantity NUMERIC(10,2) DEFAULT 1,
    price_per_unit NUMERIC(12,2) DEFAULT 0,
    total_price NUMERIC(12,2) DEFAULT 0,
    sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_estimates_status ON estimates(status);
CREATE INDEX idx_estimates_created ON estimates(created_at);
CREATE INDEX idx_estimate_items_estimate ON estimate_items(estimate_id);
