UPDATE t_p45929761_bold_move_project.ai_system_prompt
SET content = REPLACE(content,
E'Если надо удалить без замены — верни пустой массив items: []',
E'Если надо удалить без замены — верни items с action="remove":\n  {\"name\":\"Ниша ПК-14 (2 ряда)\",\"qty\":0,\"unit\":\"м\",\"wall\":\"bottom\",\"action\":\"remove\"}\n  Обязательно укажи wall — на какой стене удалять. Без wall удалит со всех стен.')
WHERE id = 1