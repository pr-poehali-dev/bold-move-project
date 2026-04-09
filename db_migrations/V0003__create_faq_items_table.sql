CREATE TABLE t_p45929761_bold_move_project.faq_items (
    id          SERIAL PRIMARY KEY,
    title       TEXT NOT NULL,
    search_title TEXT,
    content     TEXT,
    used        BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);