ALTER TABLE t_p45929761_bold_move_project.live_chats
  ADD COLUMN IF NOT EXISTS install_date timestamp with time zone NULL,
  ADD COLUMN IF NOT EXISTS contract_sum numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS prepayment numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS extra_payment numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS extra_agreement_sum numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS responsible_phone text NULL,
  ADD COLUMN IF NOT EXISTS map_link text NULL,
  ADD COLUMN IF NOT EXISTS tags text[] NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS photo_before_url text NULL,
  ADD COLUMN IF NOT EXISTS photo_after_url text NULL,
  ADD COLUMN IF NOT EXISTS document_url text NULL;
