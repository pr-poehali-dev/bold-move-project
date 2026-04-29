ALTER TABLE t_p45929761_bold_move_project.users
  ADD COLUMN IF NOT EXISTS brand_logo_url_dark    TEXT,
  ADD COLUMN IF NOT EXISTS brand_logo_orientation TEXT DEFAULT 'horizontal',
  ADD COLUMN IF NOT EXISTS pdf_logo_bg            TEXT DEFAULT 'auto';