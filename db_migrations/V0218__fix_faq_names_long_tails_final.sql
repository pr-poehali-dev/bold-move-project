-- Финальная чистка: длинные названия >55 символов обрезаем по последней закрытой «) » или по " (холодный" и т.п.
UPDATE t_p45929761_bold_move_project.faq_items
SET items = (
  SELECT jsonb_agg(
    item || jsonb_build_object(
      'name',
      (
        WITH v AS (SELECT btrim(item->>'name') AS s)
        SELECT CASE
          -- Обрезаем по ", " + слово в скобках-суффиксе типа "(холодный свет), д..."
          WHEN s ~ '\([^)]+\),?\s+[а-яА-Яa-zA-Z]$' OR (length(s) > 55 AND right(s,1) ~ '[а-яa-z]' AND s !~ '»\s*$' AND s !~ '"\s*$' AND s !~ 'м\s*$' AND s !~ 'Wt\s*$' AND s !~ '\d\s*$')
          THEN (
            WITH cleaned AS (
              -- Убираем суффиксы типа " (холодный свет), д" " с цветовой температурой 6000К (холодный свет), д"
              SELECT regexp_replace(s,
                '\s*[,(]\s*(холодный|тёплый|нейтральный|цветовой|температур|предназначен|представляет|премиум)[^)»"]*$',
                '', 'ig') AS v
            ),
            trimmed AS (
              SELECT btrim(regexp_replace(v, '[,\s.(]+$', '')) AS v FROM cleaned
            )
            SELECT upper(left(v,1)) || substring(v from 2) FROM trimmed WHERE length(v)>0
          )
          ELSE upper(left(s,1)) || substring(s from 2)
        END
        FROM v WHERE length(s)>0
      )
    )
  )
  FROM jsonb_array_elements(items) AS item
)
WHERE jsonb_array_length(items) > 0;