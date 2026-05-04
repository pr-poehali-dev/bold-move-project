CREATE TABLE IF NOT EXISTS t_p45929761_bold_move_project.price_category_settings (
    category TEXT PRIMARY KEY,
    is_material BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Заполняем существующие категории: всё кроме "Монтаж" — материал
INSERT INTO t_p45929761_bold_move_project.price_category_settings (category, is_material)
SELECT DISTINCT category, (category != 'Монтаж') as is_material
FROM t_p45929761_bold_move_project.ai_prices
ON CONFLICT (category) DO NOTHING;
