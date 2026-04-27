ALTER TABLE t_p45929761_bold_move_project.users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;

UPDATE t_p45929761_bold_move_project.users
  SET approved = true
  WHERE role = 'client';

UPDATE t_p45929761_bold_move_project.users
  SET approved = true
  WHERE email = '19.jeka.94@gmail.com';
