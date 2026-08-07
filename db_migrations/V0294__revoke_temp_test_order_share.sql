UPDATE t_p45929761_bold_move_project.order_shares
SET token = 'revoked_' || token
WHERE token = 'test_preview_token_12345';