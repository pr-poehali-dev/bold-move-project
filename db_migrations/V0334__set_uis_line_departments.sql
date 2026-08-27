UPDATE t_p45929761_bold_move_project.integrations
SET config = config || jsonb_build_object(
  'uis_line1_department', 'Приём звонков (РОЗНИЦА) кол центр 1 линия',
  'uis_line2_department', 'Приём звонков (РОЗНИЦА) наш менеджер 2 линия'
)
WHERE company_id = 8;