-- Восстанавливаем связь заказов с источниками после переименования источников
-- (company_id=8): "Директ" -> "Квиз", "Квиз" -> "Звонок на прямую".
-- Замена выполняется одновременно (через CASE), чтобы избежать цепного смешения значений.
UPDATE t_p45929761_bold_move_project.live_chats
SET source = CASE
  WHEN source = 'Директ' THEN 'Квиз'
  WHEN source = 'Квиз'   THEN 'Звонок на прямую'
  ELSE source
END
WHERE company_id = 8 AND source IN ('Директ', 'Квиз');