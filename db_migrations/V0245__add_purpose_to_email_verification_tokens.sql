ALTER TABLE t_p45929761_bold_move_project.email_verification_tokens
  ADD COLUMN IF NOT EXISTS purpose VARCHAR(20) NOT NULL DEFAULT 'registration';