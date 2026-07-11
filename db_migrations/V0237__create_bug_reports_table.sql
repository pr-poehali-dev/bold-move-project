CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.bug_reports (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    severity VARCHAR(20) NOT NULL DEFAULT 'normal',
    report_type VARCHAR(20) NOT NULL DEFAULT 'bug',
    status VARCHAR(20) NOT NULL DEFAULT 'new',
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    author_id INTEGER,
    author_name VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON t_p45929761_bold_move_project.bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created ON t_p45929761_bold_move_project.bug_reports(created_at DESC);