-- Блок "Ответственные": расширяем модель с одного ответственного (assigned_to —
-- менеджер 1 линии) до пяти параллельных ролей. Каждое поле — id сотрудника (users.id),
-- может быть NULL (роль ещё не назначена).
ALTER TABLE t_p45929761_bold_move_project.live_chats
  ADD COLUMN IF NOT EXISTS assigned_manager2      INTEGER,
  ADD COLUMN IF NOT EXISTS assigned_measurer       INTEGER,
  ADD COLUMN IF NOT EXISTS assigned_technologist   INTEGER,
  ADD COLUMN IF NOT EXISTS assigned_installer       INTEGER;

CREATE INDEX IF NOT EXISTS idx_live_chats_assigned_manager2
  ON t_p45929761_bold_move_project.live_chats (assigned_manager2);
CREATE INDEX IF NOT EXISTS idx_live_chats_assigned_measurer
  ON t_p45929761_bold_move_project.live_chats (assigned_measurer);
CREATE INDEX IF NOT EXISTS idx_live_chats_assigned_technologist
  ON t_p45929761_bold_move_project.live_chats (assigned_technologist);
CREATE INDEX IF NOT EXISTS idx_live_chats_assigned_installer
  ON t_p45929761_bold_move_project.live_chats (assigned_installer);