-- Чистим названия: обрезаем до " — "/" – "/" - ", убираем точку в конце, первая буква заглавная
UPDATE t_p45929761_bold_move_project.faq_items
SET items = (
  SELECT jsonb_agg(
    item || jsonb_build_object(
      'name',
      (
        WITH cleaned AS (
          SELECT btrim(
            regexp_replace(
              regexp_replace(
                item->>'name',
                '\s+(—|–|-)\s+.*$', ''
              ),
              '[.\s]+$', ''
            )
          ) AS v
        )
        SELECT upper(left(v, 1)) || substring(v from 2)
        FROM cleaned
        WHERE length(v) > 0
      )
    )
  )
  FROM jsonb_array_elements(items) AS item
)
WHERE jsonb_array_length(items) > 0;