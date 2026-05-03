CREATE TABLE auto_rules_v2 (
  id          SERIAL PRIMARY KEY,
  company_id  INTEGER      NOT NULL,
  key         VARCHAR(64)  NOT NULL,
  label       VARCHAR(128) NOT NULL,
  pct         NUMERIC(6,2) NULL,
  enabled     BOOLEAN      NOT NULL DEFAULT true,
  visible     BOOLEAN      NOT NULL DEFAULT true,
  row_type    VARCHAR(16)  NOT NULL DEFAULT 'cost',
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  is_default  BOOLEAN      NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT auto_rules_v2_company_key_unique UNIQUE (company_id, key)
);

-- Отдельная настройка авто-режима на компанию
CREATE TABLE auto_rules_settings (
  company_id   INTEGER PRIMARY KEY,
  auto_mode    BOOLEAN NOT NULL DEFAULT false,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
