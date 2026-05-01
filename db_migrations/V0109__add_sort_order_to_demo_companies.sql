-- Добавляем sort_order в demo_companies для ручной сортировки
ALTER TABLE t_p45929761_bold_move_project.demo_companies
    ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Инициализируем sort_order по дате создания (старые — выше)
UPDATE t_p45929761_bold_move_project.demo_companies
    SET sort_order = sub.rn
    FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
        FROM t_p45929761_bold_move_project.demo_companies
    ) sub
    WHERE t_p45929761_bold_move_project.demo_companies.id = sub.id;
