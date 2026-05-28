UPDATE t_p45929761_bold_move_project.faq_items
SET items = (
  SELECT jsonb_agg(
    item || jsonb_build_object(
      'name',
      initcap(
        btrim(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  item->>'name',
                  ' (—|–|-) .*$', '', 'g'
                ),
                '\s*\(наименование\)\.?\s*$', '', 'i'
              ),
              '\.\s*$', '', 'g'
            ),
            '\s+$', '', 'g'
          )
        )
      )
    )
  )
  FROM jsonb_array_elements(items) AS item
)
WHERE jsonb_array_length(items) > 0;