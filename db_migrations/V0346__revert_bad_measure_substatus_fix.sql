-- Откат ошибочной попытки V0345: подэтапа "Замер назначен" не существует —
-- "Замер назначен" это подпись самого статуса status='measure' на фронте
-- (crmApi.ts STATUS_LABELS), а не отдельный substatus. Возвращаем заявки
-- к правильному состоянию: sub_status=NULL (fallback на подпись статуса),
-- как и предполагает существующая логика в crm-manager (снятие подэтапа
-- "Дата замера не назначена" при заполнении measure_date).
UPDATE t_p45929761_bold_move_project.live_chats
SET sub_status = NULL
WHERE id IN (576, 601)
  AND measure_date IS NOT NULL
  AND sub_status = '12';
