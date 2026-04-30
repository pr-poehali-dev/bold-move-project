CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.demo_companies (
  id          SERIAL PRIMARY KEY,
  site_url    TEXT NOT NULL,
  company_id  INTEGER NOT NULL REFERENCES t_p45929761_bold_move_project.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_companies_company_id
  ON t_p45929761_bold_move_project.demo_companies (company_id);
