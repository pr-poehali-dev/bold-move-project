-- Бэкап облачных ссылок на картинки перед переводом на локальные пути.
-- Позволяет откатить замену одним UPDATE из этой таблицы.
CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.image_url_backup_cloud (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(64) NOT NULL,
    column_name VARCHAR(64) NOT NULL,
    row_id INTEGER NOT NULL,
    old_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO t_p45929761_bold_move_project.image_url_backup_cloud (table_name, column_name, row_id, old_url)
SELECT 'ai_prices', 'image_url', id, image_url
FROM t_p45929761_bold_move_project.ai_prices
WHERE image_url LIKE '%cdn.poehali.dev%';

INSERT INTO t_p45929761_bold_move_project.image_url_backup_cloud (table_name, column_name, row_id, old_url)
SELECT 'ai_prices', 'category_image_url', id, category_image_url
FROM t_p45929761_bold_move_project.ai_prices
WHERE category_image_url LIKE '%cdn.poehali.dev%';

INSERT INTO t_p45929761_bold_move_project.image_url_backup_cloud (table_name, column_name, row_id, old_url)
SELECT 'users', 'brand_logo_url', id, brand_logo_url
FROM t_p45929761_bold_move_project.users
WHERE brand_logo_url LIKE '%cdn.poehali.dev%';

INSERT INTO t_p45929761_bold_move_project.image_url_backup_cloud (table_name, column_name, row_id, old_url)
SELECT 'users', 'bot_avatar_url', id, bot_avatar_url
FROM t_p45929761_bold_move_project.users
WHERE bot_avatar_url LIKE '%cdn.poehali.dev%';