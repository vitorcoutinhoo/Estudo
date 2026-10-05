CREATE TABLE IF NOT EXISTS topics (
    id             BIGSERIAL PRIMARY KEY,
    title          TEXT        NOT NULL,
    description    TEXT        NOT NULL DEFAULT '',
    priority       TEXT        NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
    status         TEXT        NOT NULL DEFAULT 'todo'   CHECK (status IN ('todo','in_progress','done')),
    target_minutes INT         NOT NULL DEFAULT 0 CHECK (target_minutes >= 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schedule_items (
    id              BIGSERIAL PRIMARY KEY,
    topic_id        BIGINT  NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    date            DATE    NOT NULL,
    planned_minutes INT     NOT NULL DEFAULT 60 CHECK (planned_minutes >= 0),
    done            BOOLEAN NOT NULL DEFAULT FALSE,
    note            TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_schedule_date ON schedule_items(date);

CREATE TABLE IF NOT EXISTS study_sessions (
    id         BIGSERIAL PRIMARY KEY,
    topic_id   BIGINT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    date       DATE   NOT NULL,
    minutes    INT    NOT NULL CHECK (minutes > 0),
    note       TEXT   NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON study_sessions(date);

CREATE TABLE IF NOT EXISTS exercises (
    id         BIGSERIAL PRIMARY KEY,
    topic_id   BIGINT  NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    title      TEXT    NOT NULL,
    statement  TEXT    NOT NULL DEFAULT '',
    solution   TEXT    NOT NULL DEFAULT '',
    solved     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
