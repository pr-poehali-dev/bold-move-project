CREATE TABLE t_p45929761_bold_move_project.discount_history (
  id           SERIAL PRIMARY KEY,
  client_id    INTEGER      NOT NULL,
  company_id   INTEGER      NOT NULL,
  discount_pct NUMERIC(6,2) NOT NULL,
  discount_amount NUMERIC(12,2) NOT NULL,
  contract_sum_before NUMERIC(12,2) NOT NULL,
  contract_sum_after  NUMERIC(12,2) NOT NULL,
  is_active    BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_discount_history_client ON t_p45929761_bold_move_project.discount_history(client_id);
