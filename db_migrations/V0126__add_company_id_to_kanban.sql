-- Добавляем company_id в kanban_columns
ALTER TABLE t_p45929761_bold_move_project.kanban_columns
  ADD COLUMN IF NOT EXISTS company_id integer REFERENCES t_p45929761_bold_move_project.users(id);

-- Привязываем существующие колонки к мастер-аккаунту (id=2)
UPDATE t_p45929761_bold_move_project.kanban_columns
  SET company_id = 2 WHERE company_id IS NULL;

-- Делаем company_id обязательным
ALTER TABLE t_p45929761_bold_move_project.kanban_columns
  ALTER COLUMN company_id SET NOT NULL;

-- Добавляем company_id в kanban_cards для быстрой фильтрации
ALTER TABLE t_p45929761_bold_move_project.kanban_cards
  ADD COLUMN IF NOT EXISTS company_id integer REFERENCES t_p45929761_bold_move_project.users(id);

-- Привязываем существующие карточки через колонку
UPDATE t_p45929761_bold_move_project.kanban_cards kc
  SET company_id = col.company_id
  FROM t_p45929761_bold_move_project.kanban_columns col
  WHERE kc.column_id = col.id AND kc.company_id IS NULL;

-- Индексы для быстрой фильтрации
CREATE INDEX IF NOT EXISTS idx_kanban_columns_company ON t_p45929761_bold_move_project.kanban_columns(company_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_company ON t_p45929761_bold_move_project.kanban_cards(company_id);
