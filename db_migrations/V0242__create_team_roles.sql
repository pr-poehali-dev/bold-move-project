-- Роли команды: шаблоны наборов прав, которые владелец компании может создавать
-- и переиспользовать для нескольких сотрудников
CREATE TABLE t_p45929761_bold_move_project.team_roles (
    id           SERIAL PRIMARY KEY,
    company_id   INT NOT NULL REFERENCES t_p45929761_bold_move_project.users(id),
    name         TEXT NOT NULL,
    permissions  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    removed_at   TIMESTAMPTZ
);

CREATE INDEX idx_team_roles_company ON t_p45929761_bold_move_project.team_roles(company_id) WHERE removed_at IS NULL;

-- Ссылка сотрудника на выбранную роль (шаблон). NULL = права настроены вручную,
-- без привязки к шаблону роли.
ALTER TABLE t_p45929761_bold_move_project.users
    ADD COLUMN team_role_id INT REFERENCES t_p45929761_bold_move_project.team_roles(id);
