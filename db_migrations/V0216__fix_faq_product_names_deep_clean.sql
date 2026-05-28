UPDATE t_p45929761_bold_move_project.faq_items
SET items = (
  SELECT jsonb_agg(
    item || jsonb_build_object(
      'name',
      (
        WITH step1 AS (
          -- Обрезаем по " — "/" – "/" - "
          SELECT regexp_replace(item->>'name', '\s+(—|–|-)\s+.*$', '') AS v
        ),
        step2 AS (
          -- Обрезаем по ". Наименование:", ". Материал:", ". Цена:", ". Используется", ". Представляет", ". Описание:", ". Цвет:", ". Товар"
          SELECT regexp_replace(v,
            '\.\s*(Наименование|Материал|Цена|Используется|Представляет|Описание|Цвет|Товар|Применяется)\s*[:»].*$',
            '', 'i') AS v
          FROM step1
        ),
        step3 AS (
          -- Убираем скобки с "наименование" или "платформа" в конце
          SELECT regexp_replace(v, '\s*\((наименование|платформа)\)\s*\.?\s*$', '', 'i') AS v
          FROM step2
        ),
        step4 AS (
          -- Убираем точку и пробелы в конце
          SELECT btrim(regexp_replace(v, '[.\s]+$', '')) AS v
          FROM step3
        )
        SELECT upper(left(v, 1)) || substring(v from 2)
        FROM step4
        WHERE length(v) > 0
      )
    )
  )
  FROM jsonb_array_elements(items) AS item
)
WHERE jsonb_array_length(items) > 0;