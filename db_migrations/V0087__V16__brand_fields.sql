ALTER TABLE t_p45929761_bold_move_project.users
  ADD COLUMN IF NOT EXISTS bot_name           TEXT,
  ADD COLUMN IF NOT EXISTS bot_greeting       TEXT,
  ADD COLUMN IF NOT EXISTS bot_avatar_url     TEXT,
  ADD COLUMN IF NOT EXISTS brand_logo_url     TEXT,
  ADD COLUMN IF NOT EXISTS brand_color        TEXT,
  ADD COLUMN IF NOT EXISTS support_phone      TEXT,
  ADD COLUMN IF NOT EXISTS support_email      TEXT,
  ADD COLUMN IF NOT EXISTS max_url            TEXT,
  ADD COLUMN IF NOT EXISTS working_hours      TEXT,
  ADD COLUMN IF NOT EXISTS pdf_footer_address TEXT;
