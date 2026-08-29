UPDATE t_p45929761_bold_move_project.users
SET permissions = permissions || jsonb_build_object(
  'allowed_statuses', '["new","call","cancelled","measure","measured"]'::jsonb,
  'allowed_substatuses', '["12"]'::jsonb
)
WHERE id = 74;