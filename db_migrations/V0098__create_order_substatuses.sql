CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.order_substatuses (
  id          SERIAL PRIMARY KEY,
  company_id  INTEGER NOT NULL,
  parent_status VARCHAR(64) NOT NULL,
  label       VARCHAR(128) NOT NULL,
  color       VARCHAR(16) NOT NULL DEFAULT '#a78bfa',
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_substatuses_company_parent
  ON t_p45929761_bold_move_project.order_substatuses (company_id, parent_status);
