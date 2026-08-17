-- Приводим статусы сервисных заявок (is_service=true) к новой упрощённой
-- 3-этапной воронке: new -> install_scheduled -> done.
-- Заявка №422 была на статусе "extra_paid" (доплата получена) — фактически
-- завершена, переводим в "done".
-- Заявка №476 была на статусе "contract" (договор подписан) — это всё ещё
-- начальный этап сервисной заявки, переводим в "new".
-- 490 и 504 уже "install_scheduled" — валидный статус новой схемы, не трогаем.
UPDATE t_p45929761_bold_move_project.live_chats SET status = 'done' WHERE id = 422 AND is_service = true;
UPDATE t_p45929761_bold_move_project.live_chats SET status = 'new'  WHERE id = 476 AND is_service = true;
