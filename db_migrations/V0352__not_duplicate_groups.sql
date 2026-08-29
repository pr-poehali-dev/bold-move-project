-- Группа заявок, помеченная как «не дубль»: один клиент действительно заказал
-- несколько раз (разные объекты/периоды), это не ошибка ввода.
-- Храним ключ группы (отсортированные id через запятую) — так пометка переживает
-- изменение телефона в одной из заявок и не требует чистки при удалении.
CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.not_duplicate_groups (
    id          SERIAL PRIMARY KEY,
    company_id  INTEGER NOT NULL,
    group_key   TEXT    NOT NULL,
    created_by  INTEGER NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, group_key)
);

CREATE INDEX IF NOT EXISTS idx_not_dup_groups_company
    ON t_p45929761_bold_move_project.not_duplicate_groups (company_id);