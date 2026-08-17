-- Включаем приём заявок с почты для company_id=8: галочка "email_leads_enabled".
-- Ящик/пароль явно не заданы в config — код использует дефолт
-- mospotolkipro@gmail.com + LEAKAD_IMAP_APP_PASSWORD из секретов, этого достаточно.
UPDATE t_p45929761_bold_move_project.integrations
SET config = jsonb_set(config::jsonb, '{email_leads_enabled}', '"true"')::json,
    updated_at = NOW()
WHERE company_id = 8;
