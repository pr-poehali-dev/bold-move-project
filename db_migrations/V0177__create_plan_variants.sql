CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.plan_variants (
  id          serial PRIMARY KEY,
  room_id     integer NOT NULL,
  name        text NOT NULL DEFAULT 'Вариант 1',
  data        jsonb NOT NULL DEFAULT '{}',
  thumbnail   text NULL,
  is_active   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_variants_room_id ON t_p45929761_bold_move_project.plan_variants(room_id);