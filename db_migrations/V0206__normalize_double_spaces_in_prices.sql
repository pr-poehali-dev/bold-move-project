UPDATE t_p45929761_bold_move_project.ai_prices 
SET name = regexp_replace(name, '\s+', ' ', 'g'),
    synonyms = regexp_replace(synonyms, '\s+', ' ', 'g')
WHERE name ~ '\s{2,}' OR synonyms ~ '\s{2,}';