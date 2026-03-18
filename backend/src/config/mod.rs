use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub auth: AuthConfig,
    pub package: PackageConfig,
    pub sessions: Option<SessionsConfig>,
    pub agent: Option<AgentConfig>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct AgentConfig {
    pub pi_binary: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct SessionsConfig {
    pub base_path: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ServerConfig {
    pub port: u16,
    pub host: String,
    pub server_id: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct AuthConfig {
    pub username: String,
    pub password_hash: String,
    pub session_ttl_hours: u64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct PackageConfig {
    pub name: String,
    pub install_command: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                port: 5454,
                host: "0.0.0.0".to_string(),
                server_id: None,
            },
            auth: AuthConfig {
                username: "admin".to_string(),
                password_hash: String::new(),
                session_ttl_hours: 24,
            },
            package: PackageConfig {
                name: "@mariozechner/pi-coding-agent".to_string(),
                install_command: None,
            },
            sessions: None,
            agent: None,
        }
    }
}

impl AppConfig {
    pub fn pi_binary(&self) -> String {
        if let Some(path) = self.agent.as_ref().and_then(|a| a.pi_binary.as_ref()) {
            return path.clone();
        }
        if let Ok(output) = std::process::Command::new("which").arg("pi").output() {
            if output.status.success() {
                let resolved = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !resolved.is_empty() {
                    return resolved;
                }
            }
        }
        "pi".to_string()
    }

    pub fn sessions_base_path(&self) -> PathBuf {
        self.sessions
            .as_ref()
            .and_then(|s| s.base_path.as_ref())
            .map(|p| {
                let expanded = if p.starts_with('~') {
                    if let Some(home) = std::env::var_os("HOME") {
                        p.replacen('~', &home.to_string_lossy(), 1)
                    } else {
                        p.clone()
                    }
                } else {
                    p.clone()
                };
                PathBuf::from(expanded)
            })
            .unwrap_or_else(|| {
                let home = std::env::var("HOME").unwrap_or_else(|_| "/root".to_string());
                PathBuf::from(home).join(".pi/agent/sessions")
            })
    }

    pub fn load(path: Option<PathBuf>) -> anyhow::Result<Self> {
        let config_path = path.unwrap_or_else(|| PathBuf::from("config.toml"));
        let mut config = if config_path.exists() {
            let content = std::fs::read_to_string(&config_path)?;
            toml::from_str(&content)?
        } else {
            AppConfig::default()
        };

        if config.server.server_id.is_none() {
            let id = uuid::Uuid::new_v4().to_string();
            config.server.server_id = Some(id);
            let content = toml::to_string_pretty(&config)?;
            std::fs::write(&config_path, content)?;
        }

        Ok(config)
    }

    pub fn server_id(&self) -> &str {
        self.server.server_id.as_deref().unwrap_or("unknown")
    }
}
