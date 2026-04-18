CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.ai_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamp DEFAULT now()
);

INSERT INTO t_p45929761_bold_move_project.ai_settings (key, value)
VALUES ('llm_threshold', '0')
ON CONFLICT (key) DO NOTHING;