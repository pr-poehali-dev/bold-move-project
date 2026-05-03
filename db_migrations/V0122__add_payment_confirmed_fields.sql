ALTER TABLE t_p45929761_bold_move_project.live_chats
  ADD COLUMN IF NOT EXISTS prepayment_confirmed     BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS prepayment_confirmed_at  TIMESTAMPTZ  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS prepayment_fact          NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS extra_payment_confirmed     BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS extra_payment_confirmed_at  TIMESTAMPTZ  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS extra_payment_fact          NUMERIC(12,2) DEFAULT NULL;
