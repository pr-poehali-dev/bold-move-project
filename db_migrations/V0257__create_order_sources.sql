-- Справочник источников заявок (по образцу client_statuses).
-- Значения общие для компании. Предзаполнение (Авито/Директ/Квиз) делает бэкенд при первом GET.
CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.order_sources (
  id         SERIAL PRIMARY KEY,
  company_id INTEGER      NOT NULL,
  name       VARCHAR(64)  NOT NULL,
  color      VARCHAR(16)  NOT NULL DEFAULT '#7c3aed',
  sort_order INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT order_sources_company_name_unique UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_order_sources_company
  ON t_p45929761_bold_move_project.order_sources (company_id);