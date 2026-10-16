-- Schema version 1. Section payloads are validated JSON; the frontend validates their shape (Zod).
CREATE TABLE problems (
    id            TEXT PRIMARY KEY,
    version       INTEGER NOT NULL,
    title         TEXT NOT NULL,
    content_hash  TEXT,
    updated_at    TEXT NOT NULL
);

CREATE TABLE sessions (
    id              TEXT PRIMARY KEY,
    problem_id      TEXT NOT NULL,
    problem_version INTEGER NOT NULL,
    title           TEXT NOT NULL,
    status          TEXT NOT NULL,
    schema_version  INTEGER NOT NULL,
    revision        INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    extra           TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_sessions_updated ON sessions(updated_at DESC);

CREATE TABLE architectures (
    session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
    payload    TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE requirements (
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    id         TEXT NOT NULL,
    position   INTEGER NOT NULL,
    payload    TEXT NOT NULL,
    PRIMARY KEY (session_id, id)
);

CREATE TABLE decisions (
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    id         TEXT NOT NULL,
    position   INTEGER NOT NULL,
    payload    TEXT NOT NULL,
    PRIMARY KEY (session_id, id)
);

CREATE TABLE messages (
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    id         TEXT NOT NULL,
    position   INTEGER NOT NULL,
    payload    TEXT NOT NULL,
    PRIMARY KEY (session_id, id)
);

CREATE TABLE reviews (
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    id         TEXT NOT NULL,
    position   INTEGER NOT NULL,
    payload    TEXT NOT NULL,
    PRIMARY KEY (session_id, id)
);

CREATE TABLE findings (
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    id         TEXT NOT NULL,
    position   INTEGER NOT NULL,
    payload    TEXT NOT NULL,
    PRIMARY KEY (session_id, id)
);

CREATE TABLE summaries (
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    id         TEXT NOT NULL,
    position   INTEGER NOT NULL,
    payload    TEXT NOT NULL,
    PRIMARY KEY (session_id, id)
);

-- Non-secret preferences only (theme, selected provider/model). Never API keys.
CREATE TABLE preferences (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
