CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.pricing_settings (
  id            SERIAL PRIMARY KEY,
  econom_mult   NUMERIC(5,3) NOT NULL DEFAULT 0.85,
  premium_mult  NUMERIC(5,3) NOT NULL DEFAULT 1.27,
  econom_label  TEXT NOT NULL DEFAULT 'Econom',
  standard_label TEXT NOT NULL DEFAULT 'Standard',
  premium_label TEXT NOT NULL DEFAULT 'Premium',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Вставляем дефолтную строку если её нет
INSERT INTO t_p45929761_bold_move_project.pricing_settings
  (econom_mult, premium_mult, econom_label, standard_label, premium_label)
SELECT 0.85, 1.27, 'Econom', 'Standard', 'Premium'
WHERE NOT EXISTS (
  SELECT 1 FROM t_p45929761_bold_move_project.pricing_settings
);