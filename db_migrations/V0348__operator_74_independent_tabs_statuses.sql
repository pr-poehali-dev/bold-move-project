UPDATE t_p45929761_bold_move_project.users
SET permissions = permissions || jsonb_build_object(
  'allowed_tabs', '["leads","working","measures","done"]'::jsonb,
  'allowed_statuses', '["new","call","measure","measured","cancelled"]'::jsonb
)
WHERE id = 74;