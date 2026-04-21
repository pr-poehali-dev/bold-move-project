CREATE TABLE t_p45929761_bold_move_project.estimate_cache (
  id SERIAL PRIMARY KEY,
  text_hash VARCHAR(64) NOT NULL UNIQUE,
  request_text TEXT NOT NULL,
  answer TEXT NOT NULL,
  items JSONB NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_estimate_cache_hash ON t_p45929761_bold_move_project.estimate_cache(text_hash);