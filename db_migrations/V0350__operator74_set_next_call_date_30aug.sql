-- Оператору (user 74): проставить дату следующего звонка 30.08.2026 12:00 МСК
-- всем его активным заявкам, где дата не заполнена.
-- Закрытые/отменённые/скрытые заявки не трогаем — по ним звонить не нужно.
UPDATE t_p45929761_bold_move_project.live_chats
SET next_call_date = '2026-08-30 09:00:00+00'::timestamptz,
    no_call_needed = false,
    updated_at = NOW()
WHERE assigned_to = 74
  AND next_call_date IS NULL
  AND status IN ('new', 'call', 'measure', 'measured', 'contract', 'prepaid', 'install_scheduled', 'install_done', 'extra_paid');