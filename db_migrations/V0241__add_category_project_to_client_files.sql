ALTER TABLE client_files ADD COLUMN IF NOT EXISTS project_id INTEGER;
ALTER TABLE client_files ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'Фото до';
ALTER TABLE client_files ALTER COLUMN client_id SET DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_client_files_project_id ON client_files(project_id);
CREATE INDEX IF NOT EXISTS idx_client_files_client_id_category ON client_files(client_id, category);
