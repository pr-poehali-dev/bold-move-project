INSERT INTO t_p45929761_bold_move_project.complex_word_exceptions (word)
SELECT unnest(ARRAY['диффузор', 'дифузор', 'вентил'])
WHERE NOT EXISTS (
  SELECT 1 FROM t_p45929761_bold_move_project.complex_word_exceptions WHERE word = 'диффузор'
);