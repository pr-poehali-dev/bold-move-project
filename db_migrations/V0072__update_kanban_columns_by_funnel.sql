-- Обновляем существующие колонки и добавляем новые по этапам воронки
UPDATE t_p45929761_bold_move_project.kanban_columns SET title = 'Новые заявки', color = '#8b5cf6', position = 0 WHERE id = 1;
UPDATE t_p45929761_bold_move_project.kanban_columns SET title = 'В работе',     color = '#a78bfa', position = 1 WHERE id = 2;

INSERT INTO t_p45929761_bold_move_project.kanban_columns (title, color, position) VALUES
  ('Замеры',    '#f59e0b', 2),
  ('Монтажи',   '#f97316', 3),
  ('Выполнено', '#10b981', 4),
  ('Отказники', '#ef4444', 5);
