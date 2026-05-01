CREATE TABLE t_p45929761_bold_move_project.demo_presentations (
  id             SERIAL PRIMARY KEY,
  demo_id        INTEGER NOT NULL REFERENCES t_p45929761_bold_move_project.demo_companies(id),
  scheduled_at   TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_min   INTEGER NOT NULL DEFAULT 60,
  notes          TEXT NULL,
  status         TEXT NOT NULL DEFAULT 'scheduled',
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);