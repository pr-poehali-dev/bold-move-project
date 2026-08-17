-- Дата фактического закрытия сделки (перехода в статус 'done').
-- Фиксируется один раз при первом попадании в 'done' и не съезжает
-- при последующих правках карточки — в отличие от status_changed_at/updated_at.
ALTER TABLE t_p45929761_bold_move_project.live_chats
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Бэкфилл для уже закрытых сделок: берём лучшую доступную дату,
-- чтобы исторические отчёты не потеряли эти сделки.
UPDATE t_p45929761_bold_move_project.live_chats
SET closed_at = COALESCE(install_date, status_changed_at, updated_at, created_at)
WHERE status = 'done' AND closed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_live_chats_closed_at ON t_p45929761_bold_move_project.live_chats (closed_at);
