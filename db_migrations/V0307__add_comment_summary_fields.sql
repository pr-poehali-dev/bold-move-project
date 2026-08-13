-- Блок «Комментарий»: 4 текстовых поля под конкретные комментарии + 2 summary-поля.
-- notes (старое поле «Комментарий») больше не редактируется руками в блоке «Контакты» —
-- его СОДЕРЖИМОЕ переносим в summary_comm («Summary по коммуникациям»), т.к. именно туда
-- ИИ-анализ (backend/crm-ai) уже пишет автосводку по переписке. Колонку notes не удаляем —
-- она остаётся как техническая история/фолбэк, просто фронтенд перестаёт её показывать.
ALTER TABLE t_p45929761_bold_move_project.live_chats
  ADD COLUMN IF NOT EXISTS comment_order   TEXT,  -- комментарий к заявке
  ADD COLUMN IF NOT EXISTS comment_measure TEXT,  -- комментарий к замеру
  ADD COLUMN IF NOT EXISTS comment_install TEXT,  -- комментарий к монтажу
  ADD COLUMN IF NOT EXISTS comment_client  TEXT,  -- комментарий к клиенту
  ADD COLUMN IF NOT EXISTS summary_comm    TEXT,  -- Summary по коммуникациям (сюда же пишет ИИ-анализ)
  ADD COLUMN IF NOT EXISTS summary_status  TEXT;  -- Summary по состоянию заказа (объекта)

-- Перенос текущего текста «Комментарий» (notes) в Summary по коммуникациям — один раз,
-- только там где summary_comm ещё пустой, чтобы не перезаписать уже посчитанные сводки.
UPDATE t_p45929761_bold_move_project.live_chats
SET summary_comm = notes
WHERE notes IS NOT NULL AND notes <> '' AND (summary_comm IS NULL OR summary_comm = '');
