ALTER TABLE t_p45929761_bold_move_project.bug_reports
    ADD COLUMN IF NOT EXISTS platform VARCHAR(20) NOT NULL DEFAULT 'desktop',
    ADD COLUMN IF NOT EXISTS area VARCHAR(20) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_bug_reports_platform ON t_p45929761_bold_move_project.bug_reports(platform);
CREATE INDEX IF NOT EXISTS idx_bug_reports_area ON t_p45929761_bold_move_project.bug_reports(area);
