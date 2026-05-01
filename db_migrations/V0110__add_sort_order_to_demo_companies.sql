-- Добавляем поле сортировки в demo_companies
ALTER TABLE t_p45929761_bold_move_project.demo_companies
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Инициализируем порядок по дате создания
UPDATE t_p45929761_bold_move_project.demo_companies
SET sort_order = sub.rn
FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
    FROM t_p45929761_bold_move_project.demo_companies
) sub
WHERE t_p45929761_bold_move_project.demo_companies.id = sub.id;
