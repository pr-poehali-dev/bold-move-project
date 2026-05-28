UPDATE t_p45929761_bold_move_project.faq_items
SET items = (
  SELECT jsonb_agg(
    item || jsonb_build_object(
      'name',
      (
        WITH step1 AS (
          SELECT item->>'name' AS v
        ),
        step2 AS (
          -- Обрезаем по ". " + заглавная буква (продолжение предложения)
          SELECT regexp_replace(v,
            '\.\s+(Наименование|Материал|Цена|Используется|Представляет|Описание|Цвет|Товар|Применяется|Длина|Поставляется|Предназначен|Является)[^.]*$',
            '', 'ig') AS v
          FROM step1
        ),
        step3 AS (
          -- Обрезаем по ", " + служебные слова
          SELECT regexp_replace(v,
            ',\s+(поставляется|длина|предназначен|используется|применяется|цвет температуры)[^,]*$',
            '', 'ig') AS v
          FROM step2
        ),
        step4 AS (
          -- Убираем незаконченные обрезанные хвосты (заканчивается запятой или предлогом)
          SELECT regexp_replace(v, '[,\s]+(по|для|с|в|и|на|до|от|за|к|при|об)?\s*$', '', 'ig') AS v
          FROM step3
        ),
        step5 AS (
          -- Убираем скобки "(наименование)" в конце
          SELECT regexp_replace(v, '\s*\((наименование|платформа)\)\s*\.?\s*$', '', 'i') AS v
          FROM step4
        ),
        step6 AS (
          -- Убираем обрезанные хвосты — если название заканчивается на букву и длина >60 символов, обрезаем до последнего «чистого» слова
          SELECT CASE
            WHEN length(v) > 60 AND v NOT SIMILAR TO '%(»|"|'')%'
            THEN btrim(regexp_replace(v, '\s+\S+$', ''))
            ELSE v
          END AS v
          FROM step5
        ),
        step7 AS (
          SELECT btrim(regexp_replace(v, '[.\s,]+$', '')) AS v FROM step6
        )
        SELECT upper(left(v, 1)) || substring(v from 2)
        FROM step7
        WHERE length(v) > 0
      )
    )
  )
  FROM jsonb_array_elements(items) AS item
)
WHERE jsonb_array_length(items) > 0;