ALTER TABLE t_p45929761_bold_move_project.faq_items
  ADD COLUMN IF NOT EXISTS images jsonb NULL DEFAULT '[]'::jsonb;

ALTER TABLE t_p45929761_bold_move_project.wl_faq_items
  ADD COLUMN IF NOT EXISTS images jsonb NULL DEFAULT '[]'::jsonb;