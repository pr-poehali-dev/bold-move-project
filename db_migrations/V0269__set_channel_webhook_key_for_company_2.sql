UPDATE t_p45929761_bold_move_project.integrations
SET config = config || '{"_channel_webhook_key": "5b421a0d92854495ac280f86095889a3"}'::jsonb,
    updated_at = NOW()
WHERE company_id = 2;
