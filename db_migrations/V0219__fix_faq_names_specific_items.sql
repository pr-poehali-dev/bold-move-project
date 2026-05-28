-- Точечное исправление двух проблемных названий с кавычками
UPDATE t_p45929761_bold_move_project.faq_items
SET items = (
  SELECT jsonb_agg(
    CASE
      WHEN item->>'name' LIKE 'Лента светодиодная QF «Premium» с цветовой%'
        THEN item || jsonb_build_object('name', 'Лента светодиодная QF «Premium» 6000К (холодный свет)')
      WHEN item->>'name' LIKE 'Лента светодиодная QF «RGB» представляет%'
        THEN item || jsonb_build_object('name', 'Лента светодиодная QF «RGB»')
      WHEN item->>'name' LIKE 'Закладная платформа (наименование) представляет%'
        THEN item || jsonb_build_object('name', 'Закладная платформа (стандартная)')
      ELSE item
    END
  )
  FROM jsonb_array_elements(items) AS item
)
WHERE id = 13 OR id = 10;