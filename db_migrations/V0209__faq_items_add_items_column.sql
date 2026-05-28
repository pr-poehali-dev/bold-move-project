ALTER TABLE t_p45929761_bold_move_project.faq_items
ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb;