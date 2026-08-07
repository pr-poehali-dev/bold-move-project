INSERT INTO t_p45929761_bold_move_project.order_shares (token, chat_id, company_id)
VALUES ('test_preview_token_12345', 428, NULL)
ON CONFLICT (token) DO NOTHING;