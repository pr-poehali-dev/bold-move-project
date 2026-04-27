ALTER TABLE t_p45929761_bold_move_project.users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'client';

ALTER TABLE t_p45929761_bold_move_project.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('client','designer','foreman','installer','company','manager'));

ALTER TABLE t_p45929761_bold_move_project.users
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE t_p45929761_bold_move_project.users
  ADD COLUMN IF NOT EXISTS discount INT NOT NULL DEFAULT 0;

ALTER TABLE t_p45929761_bold_move_project.users
  ADD COLUMN IF NOT EXISTS company_id INT;
