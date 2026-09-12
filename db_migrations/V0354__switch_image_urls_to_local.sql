-- Переводим ссылки на картинки с облачного CDN на локальные пути /assets/cdn/...
-- Файлы уже скачаны в public/assets/cdn/ (см. manifest.json).
-- Старые значения сохранены в image_url_backup_cloud (миграция V0353).
-- Префикс облака: https://cdn.poehali.dev/projects/<PROJECT_ID>/bucket/
-- заменяется на: /assets/cdn/
-- Структура подпапок (brand/, crm/, price-images/) сохраняется как есть.

UPDATE t_p45929761_bold_move_project.ai_prices
SET image_url = REPLACE(image_url,
    'https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/',
    '/assets/cdn/')
WHERE image_url LIKE 'https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/%';

UPDATE t_p45929761_bold_move_project.ai_prices
SET category_image_url = REPLACE(category_image_url,
    'https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/',
    '/assets/cdn/')
WHERE category_image_url LIKE 'https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/%';

UPDATE t_p45929761_bold_move_project.users
SET brand_logo_url = REPLACE(brand_logo_url,
    'https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/',
    '/assets/cdn/')
WHERE brand_logo_url LIKE 'https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/%';

UPDATE t_p45929761_bold_move_project.users
SET bot_avatar_url = REPLACE(bot_avatar_url,
    'https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/',
    '/assets/cdn/')
WHERE bot_avatar_url LIKE 'https://cdn.poehali.dev/projects/73fc8821-802d-4489-8ce7-ef196540fbf0/bucket/%';