-- Справочник категорий расходов (редактируемый пользователем)
CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.expense_categories (
    id          SERIAL PRIMARY KEY,
    company_id  INTEGER NOT NULL,
    name        VARCHAR(64) NOT NULL,
    kind        VARCHAR(16) NOT NULL DEFAULT 'general',
    color       VARCHAR(16) NOT NULL DEFAULT '#f97316',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Расходы: реклама (услуга/бюджет по источнику), зарплаты, аренда, налоги, прочее
CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.expenses (
    id           SERIAL PRIMARY KEY,
    company_id   INTEGER NOT NULL,
    category_id  INTEGER,
    source_id    INTEGER,
    employee     VARCHAR(128),
    amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
    spent_on     DATE NOT NULL DEFAULT CURRENT_DATE,
    comment      TEXT,
    created_by   INTEGER,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_company_date ON t_p45929761_bold_move_project.expenses (company_id, spent_on);
CREATE INDEX IF NOT EXISTS idx_expenses_source ON t_p45929761_bold_move_project.expenses (source_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON t_p45929761_bold_move_project.expenses (category_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_company ON t_p45929761_bold_move_project.expense_categories (company_id);
