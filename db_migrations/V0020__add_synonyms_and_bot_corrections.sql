-- Добавляем колонку synonyms в таблицу прайса
ALTER TABLE ai_prices ADD COLUMN IF NOT EXISTS synonyms TEXT DEFAULT '';

-- Создаём таблицу для обучения бота из исправлений
CREATE TABLE IF NOT EXISTS bot_corrections (
    id SERIAL PRIMARY KEY,
    session_id TEXT,
    user_text TEXT NOT NULL,
    recognized_json JSONB,
    corrected_json JSONB,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    reviewed_at TIMESTAMP
);