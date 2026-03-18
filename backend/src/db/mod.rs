use chrono::{Duration, Utc};
use rusqlite::{Connection, params};
use std::sync::Mutex;
use uuid::Uuid;

use crate::models::{OperationLog, Workspace, WorkspaceStatus};

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(path: &str) -> anyhow::Result<Self> {
        let conn = Connection::open(path)?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> anyhow::Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS operation_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                operation TEXT NOT NULL,
                status TEXT NOT NULL,
                output TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS workspaces (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                color TEXT,
                workspace_enabled INTEGER NOT NULL DEFAULT 1,
                startup_script TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            ",
        )?;
        Ok(())
    }

    pub fn create_session(&self, username: &str, ttl_hours: u64) -> anyhow::Result<(String, String)> {
        let conn = self.conn.lock().unwrap();
        let token = Uuid::new_v4().to_string();
        let now = Utc::now();
        let expires_at = now + Duration::hours(ttl_hours as i64);
        let created_str = now.to_rfc3339();
        let expires_str = expires_at.to_rfc3339();

        conn.execute(
            "INSERT INTO sessions (token, username, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)",
            params![token, username, created_str, expires_str],
        )?;
        Ok((token, expires_str))
    }

    pub fn validate_session(&self, token: &str) -> anyhow::Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        let result = conn.query_row(
            "SELECT username FROM sessions WHERE token = ?1 AND expires_at > ?2",
            params![token, now],
            |row| row.get::<_, String>(0),
        );
        match result {
            Ok(username) => Ok(Some(username)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn delete_session(&self, token: &str) -> anyhow::Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM sessions WHERE token = ?1", params![token])?;
        Ok(())
    }

    pub fn log_operation(&self, operation: &str, status: &str, output: &str) -> anyhow::Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO operation_logs (operation, status, output) VALUES (?1, ?2, ?3)",
            params![operation, status, output],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_operation_logs(&self, limit: i64) -> anyhow::Result<Vec<OperationLog>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, operation, status, output, created_at FROM operation_logs ORDER BY id DESC LIMIT ?1",
        )?;
        let logs = stmt
            .query_map(params![limit], |row| {
                Ok(OperationLog {
                    id: row.get(0)?,
                    operation: row.get(1)?,
                    status: row.get(2)?,
                    output: row.get(3)?,
                    created_at: row.get(4)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(logs)
    }

    pub fn create_workspace(
        &self,
        name: &str,
        path: &str,
        color: Option<&str>,
        workspace_enabled: bool,
        startup_script: Option<&str>,
    ) -> anyhow::Result<Workspace> {
        let conn = self.conn.lock().unwrap();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO workspaces (id, name, path, color, workspace_enabled, startup_script, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'active', ?7, ?7)",
            params![id, name, path, color, workspace_enabled as i32, startup_script, now],
        )?;

        Ok(Workspace {
            id,
            name: name.to_string(),
            path: path.to_string(),
            color: color.map(|s| s.to_string()),
            workspace_enabled,
            startup_script: startup_script.map(|s| s.to_string()),
            status: WorkspaceStatus::Active,
            created_at: now.clone(),
            updated_at: now,
        })
    }

    pub fn get_workspace(&self, id: &str) -> anyhow::Result<Option<Workspace>> {
        let conn = self.conn.lock().unwrap();
        let result = conn.query_row(
            "SELECT id, name, path, color, workspace_enabled, startup_script, status, created_at, updated_at
             FROM workspaces WHERE id = ?1",
            params![id],
            |row| Self::row_to_workspace(row),
        );
        match result {
            Ok(w) => Ok(Some(w)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn list_workspaces(&self, include_archived: bool) -> anyhow::Result<Vec<Workspace>> {
        let conn = self.conn.lock().unwrap();
        let sql = if include_archived {
            "SELECT id, name, path, color, workspace_enabled, startup_script, status, created_at, updated_at
             FROM workspaces ORDER BY created_at DESC"
        } else {
            "SELECT id, name, path, color, workspace_enabled, startup_script, status, created_at, updated_at
             FROM workspaces WHERE status = 'active' ORDER BY created_at DESC"
        };
        let mut stmt = conn.prepare(sql)?;
        let workspaces = stmt
            .query_map([], |row| Self::row_to_workspace(row))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(workspaces)
    }

    pub fn update_workspace(
        &self,
        id: &str,
        name: Option<&str>,
        path: Option<&str>,
        color: Option<Option<&str>>,
        workspace_enabled: Option<bool>,
        startup_script: Option<Option<&str>>,
    ) -> anyhow::Result<Option<Workspace>> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();

        let exists: bool = conn
            .query_row("SELECT COUNT(*) FROM workspaces WHERE id = ?1", params![id], |row| row.get::<_, i64>(0))
            .map(|c| c > 0)?;

        if !exists {
            return Ok(None);
        }

        if let Some(v) = name {
            conn.execute("UPDATE workspaces SET name = ?1, updated_at = ?2 WHERE id = ?3", params![v, now, id])?;
        }
        if let Some(v) = path {
            conn.execute("UPDATE workspaces SET path = ?1, updated_at = ?2 WHERE id = ?3", params![v, now, id])?;
        }
        if let Some(v) = color {
            conn.execute("UPDATE workspaces SET color = ?1, updated_at = ?2 WHERE id = ?3", params![v, now, id])?;
        }
        if let Some(v) = workspace_enabled {
            conn.execute("UPDATE workspaces SET workspace_enabled = ?1, updated_at = ?2 WHERE id = ?3", params![v as i32, now, id])?;
        }
        if let Some(v) = startup_script {
            conn.execute("UPDATE workspaces SET startup_script = ?1, updated_at = ?2 WHERE id = ?3", params![v, now, id])?;
        }

        drop(conn);
        self.get_workspace(id)
    }

    pub fn delete_workspace(&self, id: &str) -> anyhow::Result<bool> {
        let conn = self.conn.lock().unwrap();
        let rows = conn.execute("DELETE FROM workspaces WHERE id = ?1", params![id])?;
        Ok(rows > 0)
    }

    pub fn set_workspace_status(&self, id: &str, status: &WorkspaceStatus) -> anyhow::Result<Option<Workspace>> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        let status_str = match status {
            WorkspaceStatus::Active => "active",
            WorkspaceStatus::Archived => "archived",
        };
        let rows = conn.execute(
            "UPDATE workspaces SET status = ?1, updated_at = ?2 WHERE id = ?3",
            params![status_str, now, id],
        )?;
        if rows == 0 {
            return Ok(None);
        }
        drop(conn);
        self.get_workspace(id)
    }

    fn row_to_workspace(row: &rusqlite::Row) -> rusqlite::Result<Workspace> {
        let status_str: String = row.get(6)?;
        let enabled: i32 = row.get(4)?;
        Ok(Workspace {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            color: row.get(3)?,
            workspace_enabled: enabled != 0,
            startup_script: row.get(5)?,
            status: if status_str == "archived" { WorkspaceStatus::Archived } else { WorkspaceStatus::Active },
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    }
}
