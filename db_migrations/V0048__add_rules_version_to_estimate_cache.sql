ALTER TABLE t_p45929761_bold_move_project.estimate_cache 
ADD COLUMN IF NOT EXISTS rules_version INTEGER NOT NULL DEFAULT 0;

UPDATE t_p45929761_bold_move_project.estimate_cache SET rules_version = 0;