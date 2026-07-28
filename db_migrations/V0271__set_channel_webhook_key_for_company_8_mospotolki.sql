UPDATE t_p45929761_bold_move_project.integrations
SET config = config || '{"_channel_webhook_key": "1d9ca507bc1b40d1b0f5ea0f48279c41"}'::jsonb,
    updated_at = NOW()
WHERE company_id = 8;
