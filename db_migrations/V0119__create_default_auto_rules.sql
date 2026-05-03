CREATE TABLE default_auto_rules (
  id          SERIAL PRIMARY KEY,
  role        VARCHAR(32)  NOT NULL,
  key         VARCHAR(64)  NOT NULL,
  label       VARCHAR(128) NOT NULL,
  pct         NUMERIC(6,2) NULL,
  enabled     BOOLEAN      NOT NULL DEFAULT false,
  visible     BOOLEAN      NOT NULL DEFAULT true,
  row_type    VARCHAR(16)  NOT NULL DEFAULT 'cost',
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT default_auto_rules_role_key UNIQUE (role, key)
);

-- Дефолты для монтажника (installer)
INSERT INTO default_auto_rules (role, key, label, pct, enabled, visible, row_type, sort_order) VALUES
  ('installer', 'measure_cost',   'Замер',         10,   true,  true, 'cost',   1),
  ('installer', 'install_cost',   'Монтаж',        30,   true,  true, 'cost',   2),
  ('installer', 'manager_cost',   'Менеджер',      NULL, false, true, 'cost',   3),
  ('installer', 'technolog_cost', 'Технолог',      NULL, false, true, 'cost',   4),
  ('installer', 'ads_cost',       'Реклама (CAC)', 5,    true,  true, 'cost',   5),
  ('installer', 'other_cost',     'Другое',        NULL, false, true, 'cost',   6),
  ('installer', 'prepayment',     'Предоплата',    NULL, true,  true, 'income', 1),
  ('installer', 'extra_payment',  'Доплата',       NULL, true,  true, 'income', 2);

-- Дефолты для владельца компании (company)
INSERT INTO default_auto_rules (role, key, label, pct, enabled, visible, row_type, sort_order) VALUES
  ('company', 'measure_cost',   'Замер',         NULL, false, true, 'cost',   1),
  ('company', 'install_cost',   'Монтаж',        NULL, false, true, 'cost',   2),
  ('company', 'manager_cost',   'Менеджер',      NULL, false, true, 'cost',   3),
  ('company', 'technolog_cost', 'Технолог',      NULL, false, true, 'cost',   4),
  ('company', 'ads_cost',       'Реклама (CAC)', NULL, false, true, 'cost',   5),
  ('company', 'other_cost',     'Другое',        NULL, false, true, 'cost',   6),
  ('company', 'prepayment',     'Предоплата',    NULL, true,  true, 'income', 1),
  ('company', 'extra_payment',  'Доплата',       NULL, true,  true, 'income', 2);
