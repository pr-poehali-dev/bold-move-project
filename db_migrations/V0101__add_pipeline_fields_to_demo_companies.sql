ALTER TABLE t_p45929761_bold_move_project.demo_companies
  ADD COLUMN IF NOT EXISTS status           text    NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS contact_name     text,
  ADD COLUMN IF NOT EXISTS contact_phone    text,
  ADD COLUMN IF NOT EXISTS contact_position text,
  ADD COLUMN IF NOT EXISTS notes            text,
  ADD COLUMN IF NOT EXISTS next_action      text,
  ADD COLUMN IF NOT EXISTS next_action_date date;
