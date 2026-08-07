CREATE TABLE t_p45929761_bold_move_project.order_shares (
    id SERIAL PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    chat_id INTEGER NOT NULL REFERENCES t_p45929761_bold_move_project.live_chats(id),
    company_id INTEGER NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_shares_chat_id ON t_p45929761_bold_move_project.order_shares(chat_id);