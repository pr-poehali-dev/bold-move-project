-- Тестовая компания для white-label стенда
-- Email: whitelabel-test@demo.local, пароль: demo123 (sha256)
INSERT INTO t_p45929761_bold_move_project.users
  (email, password_hash, name, phone, role, approved, has_own_agent, agent_purchased_at,
   company_name, company_inn, company_addr, website, telegram,
   bot_name, bot_greeting, bot_avatar_url, brand_logo_url, brand_color,
   support_phone, support_email, max_url, working_hours, pdf_footer_address)
VALUES (
  'whitelabel-test@demo.local',
  -- sha256('demo123')
  'd95dbfee2bf26a1a1a51e6e4e04bff7a33ec0e1e10fb0bfcb45c6c0b03f89f6f',
  'Демо-компания «АкваПотолок»', '+79991234567', 'company', TRUE, TRUE, NOW(),
  'ООО АкваПотолок', '7712345678', 'г. Санкт-Петербург, Невский пр. 100',
  'akvapotolok.ru', '@akvapotolok',
  'Алина',
  'Здравствуйте! Я Алина — консультант компании «АкваПотолок» 👋 Помогу подобрать натяжной потолок и рассчитаю стоимость прямо сейчас.',
  'https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/files/60e2335c-4916-41e5-b894-7f4d9ca6a923.jpg',
  'https://cdn.poehali.dev/files/7105828c-c33e-48f9-ac90-02134e3cd4d7.png',
  '#06b6d4',
  '+7 (812) 555-12-34',
  'info@akvapotolok.ru',
  'https://max.ru/u/akvapotolok-demo',
  'Ежедневно 9:00–21:00',
  'г. Санкт-Петербург, Невский пр. 100 · ИНН 7712345678 · akvapotolok.ru'
)
ON CONFLICT (email) DO UPDATE SET
  has_own_agent = TRUE,
  bot_name = EXCLUDED.bot_name,
  bot_greeting = EXCLUDED.bot_greeting,
  brand_color = EXCLUDED.brand_color,
  support_phone = EXCLUDED.support_phone;
