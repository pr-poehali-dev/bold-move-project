CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.room_plans (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  name        TEXT    NOT NULL DEFAULT 'Новый план',
  data        JSONB   NOT NULL DEFAULT '{}',
  thumbnail   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_plans_user_id ON t_p45929761_bold_move_project.room_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_room_plans_updated ON t_p45929761_bold_move_project.room_plans(updated_at DESC);
