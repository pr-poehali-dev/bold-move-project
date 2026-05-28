-- Исправляем: только первая буква заглавная (не каждое слово)
UPDATE t_p45929761_bold_move_project.faq_items
SET items = (
  SELECT jsonb_agg(
    item || jsonb_build_object(
      'name',
      CASE
        WHEN length(btrim(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                item->>'name',
                ' (—|–|-) .*$', '', 'g'
              ),
              '\s*\(наименование\)\.?\s*$', '', 'i'
            ),
            '\.\s*$', '', 'g'
          )
        )) > 0
        THEN
          upper(left(btrim(regexp_replace(regexp_replace(regexp_replace(item->>'name',' (—|–|-) .*$','','g'),'\s*\(наименование\)\.?\s*$','','i'),'\.\s*$','','g')), 1))
          ||
          lower(substring(btrim(regexp_replace(regexp_replace(regexp_replace(item->>'name',' (—|–|-) .*$','','g'),'\s*\(наименование\)\.?\s*$','','i'),'\.\s*$','','g')) from 2))
        ELSE item->>'name'
      END
    )
  )
  FROM jsonb_array_elements(items) AS item
)
WHERE jsonb_array_length(items) > 0;