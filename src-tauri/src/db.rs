use crate::error::AppError;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::path::Path;
use std::sync::Mutex;

pub struct Migration {
    pub version: i64,
    pub sql: &'static str,
}

pub const MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    sql: include_str!("../migrations/0001_init.sql"),
}];

const SECTION_TABLES: [&str; 6] = [
    "requirements",
    "decisions",
    "messages",
    "reviews",
    "findings",
    "summaries",
];

const MAX_ROWS_PER_SECTION: usize = 20_000;
const MAX_PAYLOAD_BYTES: usize = 2 * 1024 * 1024;
const MAX_ID_LEN: usize = 128;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SessionMeta {
    pub id: String,
    pub problem_id: String,
    pub problem_version: i64,
    pub title: String,
    pub status: String,
    pub schema_version: i64,
    pub revision: i64,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default = "empty_object")]
    pub extra: Value,
}

fn empty_object() -> Value {
    Value::Object(Default::default())
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SessionRecord {
    pub meta: SessionMeta,
    pub architecture: Value,
    #[serde(default)]
    pub requirements: Vec<Value>,
    #[serde(default)]
    pub decisions: Vec<Value>,
    #[serde(default)]
    pub messages: Vec<Value>,
    #[serde(default)]
    pub reviews: Vec<Value>,
    #[serde(default)]
    pub findings: Vec<Value>,
    #[serde(default)]
    pub summaries: Vec<Value>,
}

impl SessionRecord {
    fn sections(&self) -> [(&'static str, &Vec<Value>); 6] {
        [
            ("requirements", &self.requirements),
            ("decisions", &self.decisions),
            ("messages", &self.messages),
            ("reviews", &self.reviews),
            ("findings", &self.findings),
            ("summaries", &self.summaries),
        ]
    }
}

pub fn migrate(
    conn: &mut Connection,
    migrations: &[Migration],
    db_path: Option<&Path>,
) -> Result<(), AppError> {
    let current: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    let latest = migrations.last().map(|m| m.version).unwrap_or(0);
    if current > latest {
        return Err(AppError::Invalid(format!(
            "database schema version {current} is newer than this app supports ({latest}); update DesignGrill"
        )));
    }
    if current == latest {
        return Ok(());
    }
    if current > 0 {
        if let Some(path) = db_path {
            backup_before_migration(conn, path, current)?;
        }
    }
    for m in migrations.iter().filter(|m| m.version > current) {
        let tx = conn.transaction()?;
        tx.execute_batch(m.sql)?;
        tx.execute_batch(&format!("PRAGMA user_version = {}", m.version))?;
        tx.commit()?;
    }
    Ok(())
}

fn backup_before_migration(conn: &Connection, path: &Path, version: i64) -> Result<(), AppError> {
    let mut backup = path.as_os_str().to_owned();
    backup.push(format!(".bak-v{version}"));
    let backup = std::path::PathBuf::from(backup);
    if backup.exists() {
        std::fs::remove_file(&backup)
            .map_err(|e| AppError::Database(format!("cannot replace old backup: {e}")))?;
    }
    let target = backup
        .to_str()
        .ok_or_else(|| AppError::Database("backup path is not valid UTF-8".into()))?;
    conn.execute("VACUUM INTO ?1", [target])?;
    Ok(())
}

fn validate_id(id: &str, what: &str) -> Result<(), AppError> {
    if id.is_empty() || id.len() > MAX_ID_LEN {
        return Err(AppError::Invalid(format!(
            "{what} id must be 1-{MAX_ID_LEN} characters"
        )));
    }
    Ok(())
}

fn validate_record(rec: &SessionRecord) -> Result<(), AppError> {
    validate_id(&rec.meta.id, "session")?;
    if !rec.architecture.is_object() {
        return Err(AppError::Invalid(
            "architecture must be a JSON object".into(),
        ));
    }
    if rec.architecture.to_string().len() > MAX_PAYLOAD_BYTES {
        return Err(AppError::Invalid(
            "architecture payload is too large".into(),
        ));
    }
    for (name, rows) in rec.sections() {
        if rows.len() > MAX_ROWS_PER_SECTION {
            return Err(AppError::Invalid(format!("too many rows in {name}")));
        }
        let mut seen = HashSet::new();
        for row in rows {
            let id = row_id(row, name)?;
            if !seen.insert(id.to_owned()) {
                return Err(AppError::Invalid(format!("duplicate id '{id}' in {name}")));
            }
        }
    }
    Ok(())
}

fn row_id<'a>(row: &'a Value, section: &str) -> Result<&'a str, AppError> {
    let id = row
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::Invalid(format!("row in {section} is missing a string id")))?;
    validate_id(id, section)?;
    Ok(id)
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self, AppError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| AppError::Database(format!("cannot create data directory: {e}")))?;
        }
        let mut conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;")?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        migrate(&mut conn, MIGRATIONS, Some(path))?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    #[cfg(test)]
    pub fn open_in_memory() -> Result<Self, AppError> {
        let mut conn = Connection::open_in_memory()?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        migrate(&mut conn, MIGRATIONS, None)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    fn lock(&self) -> Result<std::sync::MutexGuard<'_, Connection>, AppError> {
        self.conn
            .lock()
            .map_err(|_| AppError::Database("database lock poisoned".into()))
    }

    pub fn list_sessions(&self) -> Result<Vec<SessionMeta>, AppError> {
        let conn = self.lock()?;
        let mut stmt = conn.prepare(
            "SELECT id, problem_id, problem_version, title, status, schema_version, revision, created_at, updated_at, extra
             FROM sessions ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map([], read_meta)?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        Ok(out)
    }

    pub fn load_session(&self, id: &str) -> Result<Option<SessionRecord>, AppError> {
        let conn = self.lock()?;
        let meta = conn
            .query_row(
                "SELECT id, problem_id, problem_version, title, status, schema_version, revision, created_at, updated_at, extra
                 FROM sessions WHERE id = ?1",
                [id],
                read_meta,
            )
            .optional()?;
        let Some(meta) = meta else { return Ok(None) };

        let architecture: String = conn
            .query_row(
                "SELECT payload FROM architectures WHERE session_id = ?1",
                [id],
                |r| r.get(0),
            )
            .optional()?
            .ok_or_else(|| AppError::Database(format!("session {id} has no architecture row")))?;

        let mut sections: Vec<Vec<Value>> = Vec::new();
        for table in SECTION_TABLES {
            let sql =
                format!("SELECT payload FROM {table} WHERE session_id = ?1 ORDER BY position");
            let mut stmt = conn.prepare(&sql)?;
            let rows = stmt.query_map([id], |r| r.get::<_, String>(0))?;
            let mut values = Vec::new();
            for row in rows {
                values.push(serde_json::from_str(&row?)?);
            }
            sections.push(values);
        }
        let mut it = sections.into_iter();
        Ok(Some(SessionRecord {
            meta,
            architecture: serde_json::from_str(&architecture)?,
            requirements: it.next().unwrap_or_default(),
            decisions: it.next().unwrap_or_default(),
            messages: it.next().unwrap_or_default(),
            reviews: it.next().unwrap_or_default(),
            findings: it.next().unwrap_or_default(),
            summaries: it.next().unwrap_or_default(),
        }))
    }

    pub fn save_session(&self, rec: &SessionRecord) -> Result<(), AppError> {
        validate_record(rec)?;
        let mut conn = self.lock()?;
        let tx = conn.transaction()?;
        let m = &rec.meta;
        tx.execute(
            "INSERT INTO sessions (id, problem_id, problem_version, title, status, schema_version, revision, created_at, updated_at, extra)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(id) DO UPDATE SET
               problem_id = excluded.problem_id, problem_version = excluded.problem_version,
               title = excluded.title, status = excluded.status, schema_version = excluded.schema_version,
               revision = excluded.revision, updated_at = excluded.updated_at, extra = excluded.extra",
            params![
                m.id, m.problem_id, m.problem_version, m.title, m.status, m.schema_version,
                m.revision, m.created_at, m.updated_at, m.extra.to_string()
            ],
        )?;
        tx.execute(
            "INSERT INTO architectures (session_id, payload, updated_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(session_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at",
            params![m.id, rec.architecture.to_string(), m.updated_at],
        )?;
        for (table, rows) in rec.sections() {
            tx.execute(
                &format!("DELETE FROM {table} WHERE session_id = ?1"),
                [&m.id],
            )?;
            let mut stmt = tx.prepare(&format!(
                "INSERT INTO {table} (session_id, id, position, payload) VALUES (?1, ?2, ?3, ?4)"
            ))?;
            for (i, row) in rows.iter().enumerate() {
                let payload = row.to_string();
                if payload.len() > MAX_PAYLOAD_BYTES {
                    return Err(AppError::Invalid(format!("a row in {table} is too large")));
                }
                stmt.execute(params![m.id, row_id(row, table)?, i as i64, payload])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn delete_session(&self, id: &str) -> Result<bool, AppError> {
        let conn = self.lock()?;
        Ok(conn.execute("DELETE FROM sessions WHERE id = ?1", [id])? > 0)
    }

    pub fn upsert_problem(
        &self,
        id: &str,
        version: i64,
        title: &str,
        content_hash: Option<&str>,
        updated_at: &str,
    ) -> Result<(), AppError> {
        validate_id(id, "problem")?;
        let conn = self.lock()?;
        conn.execute(
            "INSERT INTO problems (id, version, title, content_hash, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET version = excluded.version, title = excluded.title,
               content_hash = excluded.content_hash, updated_at = excluded.updated_at",
            params![id, version, title, content_hash, updated_at],
        )?;
        Ok(())
    }

    pub fn list_preferences(&self) -> Result<Vec<(String, String)>, AppError> {
        let conn = self.lock()?;
        let mut stmt = conn.prepare("SELECT key, value FROM preferences ORDER BY key")?;
        let rows = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        Ok(out)
    }

    pub fn set_preference(&self, key: &str, value: Option<&str>) -> Result<(), AppError> {
        validate_id(key, "preference key")?;
        let conn = self.lock()?;
        match value {
            Some(v) => {
                if v.len() > 4096 {
                    return Err(AppError::Invalid("preference value too long".into()));
                }
                conn.execute(
                    "INSERT INTO preferences (key, value) VALUES (?1, ?2)
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    params![key, v],
                )?;
            }
            None => {
                conn.execute("DELETE FROM preferences WHERE key = ?1", [key])?;
            }
        }
        Ok(())
    }
}

fn read_meta(r: &rusqlite::Row<'_>) -> rusqlite::Result<SessionMeta> {
    let extra: String = r.get(9)?;
    Ok(SessionMeta {
        id: r.get(0)?,
        problem_id: r.get(1)?,
        problem_version: r.get(2)?,
        title: r.get(3)?,
        status: r.get(4)?,
        schema_version: r.get(5)?,
        revision: r.get(6)?,
        created_at: r.get(7)?,
        updated_at: r.get(8)?,
        extra: serde_json::from_str(&extra).unwrap_or_else(|_| empty_object()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn record(id: &str) -> SessionRecord {
        SessionRecord {
            meta: SessionMeta {
                id: id.into(),
                problem_id: "url-shortener".into(),
                problem_version: 1,
                title: "Practice".into(),
                status: "in-progress".into(),
                schema_version: 1,
                revision: 3,
                created_at: "2026-01-01T00:00:00Z".into(),
                updated_at: "2026-01-01T00:05:00Z".into(),
                extra: json!({"pendingQuestion": null}),
            },
            architecture: json!({"id": "arch-1", "nodes": [{"id": "n1"}], "edges": []}),
            requirements: vec![
                json!({"id": "r1", "title": "Redirect"}),
                json!({"id": "r2", "title": "Latency"}),
            ],
            decisions: vec![json!({"id": "d1"})],
            messages: vec![json!({"id": "m1", "content": "hello"})],
            reviews: vec![],
            findings: vec![json!({"id": "f1"})],
            summaries: vec![],
        }
    }

    #[test]
    fn save_and_load_round_trip_preserves_order() {
        let db = Database::open_in_memory().unwrap();
        let rec = record("s1");
        db.save_session(&rec).unwrap();
        assert_eq!(db.load_session("s1").unwrap().unwrap(), rec);
    }

    #[test]
    fn saving_again_replaces_sections() {
        let db = Database::open_in_memory().unwrap();
        let mut rec = record("s1");
        db.save_session(&rec).unwrap();
        rec.requirements = vec![json!({"id": "r2", "title": "Latency"})];
        rec.meta.revision = 4;
        db.save_session(&rec).unwrap();
        let loaded = db.load_session("s1").unwrap().unwrap();
        assert_eq!(loaded.requirements.len(), 1);
        assert_eq!(loaded.meta.revision, 4);
    }

    #[test]
    fn delete_removes_all_related_rows() {
        let db = Database::open_in_memory().unwrap();
        db.save_session(&record("s1")).unwrap();
        assert!(db.delete_session("s1").unwrap());
        assert!(db.load_session("s1").unwrap().is_none());
        assert!(!db.delete_session("s1").unwrap());
        let conn = db.lock().unwrap();
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM requirements", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 0);
    }

    #[test]
    fn list_orders_by_recent_update() {
        let db = Database::open_in_memory().unwrap();
        let mut a = record("a");
        a.meta.updated_at = "2026-01-02T00:00:00Z".into();
        let mut b = record("b");
        b.meta.updated_at = "2026-01-03T00:00:00Z".into();
        db.save_session(&a).unwrap();
        db.save_session(&b).unwrap();
        let ids: Vec<_> = db
            .list_sessions()
            .unwrap()
            .into_iter()
            .map(|m| m.id)
            .collect();
        assert_eq!(ids, vec!["b", "a"]);
    }

    #[test]
    fn rejects_rows_without_ids_and_duplicates() {
        let db = Database::open_in_memory().unwrap();
        let mut rec = record("s1");
        rec.requirements.push(json!({"title": "no id"}));
        assert!(db.save_session(&rec).is_err());
        let mut rec = record("s1");
        rec.requirements.push(json!({"id": "r1"}));
        assert!(db.save_session(&rec).is_err());
        assert!(db.load_session("s1").unwrap().is_none());
    }

    #[test]
    fn failed_save_leaves_previous_state_intact() {
        let db = Database::open_in_memory().unwrap();
        db.save_session(&record("s1")).unwrap();
        let mut bad = record("s1");
        bad.messages.push(json!({"nope": true}));
        assert!(db.save_session(&bad).is_err());
        assert_eq!(db.load_session("s1").unwrap().unwrap(), record("s1"));
    }

    #[test]
    fn preferences_round_trip_and_delete() {
        let db = Database::open_in_memory().unwrap();
        db.set_preference("theme", Some("dark")).unwrap();
        db.set_preference("theme", Some("light")).unwrap();
        assert_eq!(
            db.list_preferences().unwrap(),
            vec![("theme".to_string(), "light".to_string())]
        );
        db.set_preference("theme", None).unwrap();
        assert!(db.list_preferences().unwrap().is_empty());
    }

    #[test]
    fn migrations_are_idempotent_and_refuse_newer_databases() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn, MIGRATIONS, None).unwrap();
        migrate(&mut conn, MIGRATIONS, None).unwrap();
        conn.execute_batch("PRAGMA user_version = 99").unwrap();
        assert!(migrate(&mut conn, MIGRATIONS, None).is_err());
    }

    #[test]
    fn upgrade_keeps_existing_data_and_writes_backup() {
        let dir = std::env::temp_dir().join(format!("designgrill-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("upgrade.db");
        let _ = std::fs::remove_file(&path);
        let v1 = [Migration {
            version: 1,
            sql: "CREATE TABLE t (id TEXT PRIMARY KEY);",
        }];
        let v2 = [
            Migration {
                version: 1,
                sql: "CREATE TABLE t (id TEXT PRIMARY KEY);",
            },
            Migration {
                version: 2,
                sql: "ALTER TABLE t ADD COLUMN note TEXT;",
            },
        ];
        let mut conn = Connection::open(&path).unwrap();
        migrate(&mut conn, &v1, Some(&path)).unwrap();
        conn.execute("INSERT INTO t (id) VALUES ('keep')", [])
            .unwrap();
        migrate(&mut conn, &v2, Some(&path)).unwrap();
        let id: String = conn
            .query_row("SELECT id FROM t", [], |r| r.get(0))
            .unwrap();
        assert_eq!(id, "keep");
        assert!(dir.join("upgrade.db.bak-v1").exists());
        drop(conn);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn failed_migration_rolls_back() {
        let mut conn = Connection::open_in_memory().unwrap();
        let bad = [Migration {
            version: 1,
            sql: "CREATE TABLE ok (id TEXT); CREATE TABLE ok (id TEXT);",
        }];
        assert!(migrate(&mut conn, &bad, None).is_err());
        let v: i64 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(v, 0);
    }
}
