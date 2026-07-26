UPDATE t_p45929761_bold_move_project.users u
SET permissions = r.permissions
FROM t_p45929761_bold_move_project.team_roles r
WHERE u.team_role_id = r.id
  AND u.email = 'revadicc@gmail.com';