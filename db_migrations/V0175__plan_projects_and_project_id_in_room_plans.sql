
-- Таблица проектов
CREATE TABLE t_p45929761_bold_move_project.plan_projects (
  id          SERIAL PRIMARY KEY,
  company_id  INTEGER NOT NULL,
  name        TEXT    NOT NULL,
  client_name TEXT    NULL,
  address     TEXT    NULL,
  phone       TEXT    NULL,
  status      TEXT    NOT NULL DEFAULT 'draft',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON t_p45929761_bold_move_project.plan_projects (company_id);

-- Добавляем project_id в room_plans
ALTER TABLE t_p45929761_bold_move_project.room_plans
  ADD COLUMN IF NOT EXISTS project_id INTEGER NULL;

CREATE INDEX ON t_p45929761_bold_move_project.room_plans (project_id);
