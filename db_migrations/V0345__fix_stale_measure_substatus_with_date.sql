-- Заявки с уже заполненной measure_date, но подэтапом "Дата замера не назначена"
-- (или без подэтапа вовсе) — та же противоречивая ситуация, что чинил бэкенд-код
-- (crm-manager: измерение sub_status при сохранении measure_date). Разово чиним
-- существующие зависшие заявки: переводим на "Замер назначен" по компании.
UPDATE t_p45929761_bold_move_project.live_chats lc
SET sub_status = (
  SELECT os.id::text FROM t_p45929761_bold_move_project.order_substatuses os
  WHERE os.company_id = lc.company_id AND os.parent_status = 'measures' AND os.label = 'Замер назначен'
  ORDER BY os.position, os.id LIMIT 1
)
WHERE lc.status = 'measure' AND lc.measure_date IS NOT NULL
  AND (
    lc.sub_status IS NULL
    OR lc.sub_status IN (
      SELECT os2.id::text FROM t_p45929761_bold_move_project.order_substatuses os2
      WHERE os2.company_id = lc.company_id AND os2.parent_status = 'measures' AND os2.label = 'Дата замера не назначена'
    )
  )
  AND EXISTS (
    SELECT 1 FROM t_p45929761_bold_move_project.order_substatuses os3
    WHERE os3.company_id = lc.company_id AND os3.parent_status = 'measures' AND os3.label = 'Замер назначен'
  );
