use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tokio::process::Command;
use tokio::sync::{Mutex, RwLock};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum DesktopMode {
    Actual,
    Virtual,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct VncBackend {
    pub id: String,
    pub name: String,
    pub binary: String,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct DesktopEnvironment {
    pub id: String,
    pub name: String,
    pub command: String,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum SessionType {
    X11,
    Wayland,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CurrentDesktopInfo {
    pub display: Option<String>,
    pub desktop_session: Option<String>,
    pub running_de: Option<String>,
    pub session_type: SessionType,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum DesktopStatus {
    Stopped,
    Starting,
    Running,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct DesktopInfo {
    pub status: DesktopStatus,
    pub mode: Option<DesktopMode>,
    pub backend_id: Option<String>,
    pub de_id: Option<String>,
    pub display: Option<String>,
    pub vnc_port: Option<u16>,
    pub vnc_password: Option<String>,
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
// Internal process tracking
// ---------------------------------------------------------------------------

struct DesktopProcess {
    status: DesktopStatus,
    mode: DesktopMode,
    backend_id: String,
    de_id: String,
    display: String,
    vnc_port: u16,
    vnc_password: Option<String>,
    error: Option<String>,
    pids: Vec<u32>,
    kill_tx: Option<tokio::sync::oneshot::Sender<()>>,
    _handle: Option<tokio::task::JoinHandle<()>>,
}

// ---------------------------------------------------------------------------
// Desktop Manager
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct DesktopManager {
    process: Arc<RwLock<Option<DesktopProcess>>>,
    detected_backends: Arc<Mutex<Option<Vec<VncBackend>>>>,
    detected_des: Arc<Mutex<Option<Vec<DesktopEnvironment>>>>,
}

impl DesktopManager {
    pub fn new() -> Self {
        Self {
            process: Arc::new(RwLock::new(None)),
            detected_backends: Arc::new(Mutex::new(None)),
            detected_des: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn detect_backends(&self) -> Vec<VncBackend> {
        {
            let cached = self.detected_backends.lock().await;
            if let Some(ref backends) = *cached {
                return backends.clone();
            }
        }

        let candidates = vec![
            ("x11vnc", "x11vnc (X11)", "x11vnc"),
            ("wayvnc", "wayvnc (Wayland/wlroots)", "wayvnc"),
            ("krfb", "KDE Remote Desktop (Wayland)", "krfb-virtualmonitor"),
            ("tigervnc", "TigerVNC (Xvnc)", "Xvnc"),
            ("turbovnc", "TurboVNC", "Xvnc"),
        ];

        let mut backends = Vec::new();
        for (id, name, binary) in candidates {
            let available = which_exists(binary).await;
            backends.push(VncBackend {
                id: id.to_string(),
                name: name.to_string(),
                binary: binary.to_string(),
                available,
            });
        }

        let mut cached = self.detected_backends.lock().await;
        *cached = Some(backends.clone());
        backends
    }

    pub async fn detect_desktop_environments(&self) -> Vec<DesktopEnvironment> {
        {
            let cached = self.detected_des.lock().await;
            if let Some(ref des) = *cached {
                return des.clone();
            }
        }

        let mut des = Vec::new();

        // Auto-detect a terminal emulator for the "Terminal" option
        let terminal_candidates = [
            ("xterm", "xterm"),
            ("alacritty", "alacritty"),
            ("kitty", "kitty"),
            ("urxvt", "urxvt"),
            ("sakura", "sakura"),
            ("st", "st"),
            ("lxterminal", "lxterminal"),
            ("xfce4-terminal", "xfce4-terminal"),
        ];
        let mut terminal_bin: Option<&str> = None;
        for (bin, _) in &terminal_candidates {
            if which_exists(bin).await {
                terminal_bin = Some(bin);
                break;
            }
        }
        des.push(DesktopEnvironment {
            id: "terminal".into(),
            name: format!(
                "Terminal ({})",
                terminal_bin.unwrap_or("none")
            ),
            command: terminal_bin.unwrap_or("").into(),
            available: terminal_bin.is_some(),
        });

        let candidates = vec![
            ("openbox", "Openbox", "openbox-session", "openbox-session"),
            ("fluxbox", "Fluxbox", "fluxbox", "fluxbox"),
            ("i3", "i3 Window Manager", "i3", "i3"),
            ("xfce", "XFCE", "startxfce4", "startxfce4"),
            ("lxde", "LXDE", "startlxde", "startlxde"),
            ("lxqt", "LXQt", "startlxqt", "startlxqt"),
            ("mate", "MATE", "mate-session", "mate-session"),
        ];

        for (id, name, binary, command) in candidates {
            let available = which_exists(binary).await;
            des.push(DesktopEnvironment {
                id: id.to_string(),
                name: name.to_string(),
                command: command.to_string(),
                available,
            });
        }

        let mut cached = self.detected_des.lock().await;
        *cached = Some(des.clone());
        des
    }

    pub async fn detect_current_desktop(&self) -> CurrentDesktopInfo {
        let display_env = std::env::var("DISPLAY").ok();
        let desktop_session = std::env::var("DESKTOP_SESSION").ok();
        let xdg_current = std::env::var("XDG_CURRENT_DESKTOP").ok();

        let session_type = match std::env::var("XDG_SESSION_TYPE")
            .unwrap_or_default()
            .to_lowercase()
            .as_str()
        {
            "x11" => SessionType::X11,
            "wayland" => SessionType::Wayland,
            _ => {
                if std::env::var("WAYLAND_DISPLAY").is_ok() {
                    SessionType::Wayland
                } else if display_env.is_some() {
                    SessionType::X11
                } else {
                    SessionType::Unknown
                }
            }
        };

        CurrentDesktopInfo {
            display: display_env,
            desktop_session,
            running_de: xdg_current,
            session_type,
        }
    }

    pub async fn status(&self) -> DesktopInfo {
        let proc = self.process.read().await;
        match &*proc {
            Some(p) => DesktopInfo {
                status: p.status.clone(),
                mode: Some(p.mode.clone()),
                backend_id: Some(p.backend_id.clone()),
                de_id: Some(p.de_id.clone()),
                display: Some(p.display.clone()),
                vnc_port: Some(p.vnc_port),
                vnc_password: p.vnc_password.clone(),
                error: p.error.clone(),
            },
            None => DesktopInfo {
                status: DesktopStatus::Stopped,
                mode: None,
                backend_id: None,
                de_id: None,
                display: None,
                vnc_port: None,
                vnc_password: None,
                error: None,
            },
        }
    }

    // ----- start actual (screen share) -----
    pub async fn start_actual(&self) -> Result<DesktopInfo, String> {
        self.ensure_not_running().await?;

        let current = self.detect_current_desktop().await;
        let is_wayland = current.session_type == SessionType::Wayland;

        let is_kde = current.running_de.as_deref().unwrap_or("").contains("KDE");

        let backend_id: String;
        if is_wayland {
            if is_kde && which_exists("krfb-virtualmonitor").await {
                backend_id = "krfb".into();
            } else if which_exists("wayvnc").await {
                backend_id = "wayvnc".into();
            } else {
                return Err(
                    "Screen sharing on Wayland requires wayvnc (wlroots) or \
                     krfb-virtualmonitor (KDE). Install the appropriate package \
                     or use Virtual Desktop mode instead."
                        .into(),
                );
            }
        } else if which_exists("x11vnc").await {
            backend_id = "x11vnc".into();
        } else {
            return Err("x11vnc is required for screen sharing on X11 but is not installed".into());
        }

        let display_label = if is_wayland {
            std::env::var("WAYLAND_DISPLAY").unwrap_or_else(|_| "wayland-0".into())
        } else {
            std::env::var("DISPLAY").unwrap_or_else(|_| ":0".into())
        };

        let vnc_port = find_free_port(5900).await;
        let vnc_password = if backend_id == "krfb" {
            Some(generate_password())
        } else {
            None
        };
        let (kill_tx, kill_rx) = tokio::sync::oneshot::channel::<()>();

        {
            let mut proc = self.process.write().await;
            *proc = Some(DesktopProcess {
                status: DesktopStatus::Starting,
                mode: DesktopMode::Actual,
                backend_id: backend_id.clone(),
                de_id: "current".into(),
                display: display_label.clone(),
                vnc_port,
                vnc_password: vnc_password.clone(),
                error: None,
                pids: Vec::new(),
                kill_tx: Some(kill_tx),
                _handle: None,
            });
        }

        let process_ref = self.process.clone();
        let x_display = std::env::var("DISPLAY").unwrap_or_else(|_| ":0".into());
        let handle = tokio::spawn(async move {
            let result = match backend_id.as_str() {
                "krfb" => run_actual_krfb(vnc_port, vnc_password.as_deref().unwrap_or(""), &process_ref, kill_rx).await,
                "wayvnc" => run_actual_wayvnc(vnc_port, &process_ref, kill_rx).await,
                _ => run_actual_x11vnc(&x_display, vnc_port, &process_ref, kill_rx).await,
            };

            if let Err(e) = result {
                let mut proc = process_ref.write().await;
                if let Some(p) = proc.as_mut() {
                    p.status = DesktopStatus::Error;
                    p.error = Some(e);
                }
            }
        });

        {
            let mut proc = self.process.write().await;
            if let Some(p) = proc.as_mut() {
                p._handle = Some(handle);
            }
        }

        self.wait_until_settled().await;
        Ok(self.status().await)
    }

    // ----- start virtual -----
    pub async fn start_virtual(
        &self,
        backend_id: &str,
        de_id: &str,
        resolution: Option<&str>,
    ) -> Result<DesktopInfo, String> {
        self.ensure_not_running().await?;

        let backends = self.detect_backends().await;
        let backend = backends
            .iter()
            .find(|b| b.id == backend_id)
            .ok_or_else(|| format!("Unknown backend: {backend_id}"))?;
        if !backend.available {
            return Err(format!("Backend '{}' is not installed", backend.name));
        }

        let des = self.detect_desktop_environments().await;
        let de = des
            .iter()
            .find(|d| d.id == de_id)
            .ok_or_else(|| format!("Unknown desktop environment: {de_id}"))?;
        if !de.available {
            return Err(format!("DE '{}' is not installed", de.name));
        }

        let has_xvfb = which_exists("Xvfb").await;
        let use_xvnc = backend_id == "tigervnc" || backend_id == "turbovnc";

        if !use_xvnc && !has_xvfb {
            return Err("Xvfb is required for virtual desktop with x11vnc but is not installed".into());
        }

        let resolution = resolution.unwrap_or("1280x720x24");
        let display_num = find_free_display().await;
        let virt_display = format!(":{display_num}");
        let vnc_port = find_free_port(5900).await;

        let (kill_tx, kill_rx) = tokio::sync::oneshot::channel::<()>();

        {
            let mut proc = self.process.write().await;
            *proc = Some(DesktopProcess {
                status: DesktopStatus::Starting,
                mode: DesktopMode::Virtual,
                backend_id: backend_id.into(),
                de_id: de_id.into(),
                display: virt_display.clone(),
                vnc_port,
                vnc_password: None,
                error: None,
                pids: Vec::new(),
                kill_tx: Some(kill_tx),
                _handle: None,
            });
        }

        let process_ref = self.process.clone();
        let de_command = de.command.clone();
        let backend_id_owned = backend_id.to_string();
        let resolution_owned = resolution.to_string();

        let handle = tokio::spawn(async move {
            let result = run_virtual_desktop(
                &backend_id_owned,
                &de_command,
                &virt_display,
                vnc_port,
                &resolution_owned,
                &process_ref,
                kill_rx,
            )
            .await;

            if let Err(e) = result {
                let mut proc = process_ref.write().await;
                if let Some(p) = proc.as_mut() {
                    p.status = DesktopStatus::Error;
                    p.error = Some(e);
                }
            }
        });

        {
            let mut proc = self.process.write().await;
            if let Some(p) = proc.as_mut() {
                p._handle = Some(handle);
            }
        }

        self.wait_until_settled().await;
        Ok(self.status().await)
    }

    pub async fn stop(&self) -> Result<DesktopInfo, String> {
        let kill_tx = {
            let mut proc = self.process.write().await;
            match proc.as_mut() {
                Some(p) => p.kill_tx.take(),
                None => return Err("No desktop is running".to_string()),
            }
        };

        if let Some(tx) = kill_tx {
            let _ = tx.send(());
        }

        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        {
            let mut proc = self.process.write().await;
            *proc = None;
        }

        Ok(self.status().await)
    }

    pub async fn get_vnc_port(&self) -> Option<u16> {
        let proc = self.process.read().await;
        proc.as_ref()
            .filter(|p| p.status == DesktopStatus::Running)
            .map(|p| p.vnc_port)
    }

    async fn ensure_not_running(&self) -> Result<(), String> {
        let proc = self.process.read().await;
        if let Some(p) = &*proc {
            if p.status == DesktopStatus::Running || p.status == DesktopStatus::Starting {
                return Err("Desktop is already running".into());
            }
        }
        Ok(())
    }

    async fn wait_until_settled(&self) {
        for _ in 0..40 {
            tokio::time::sleep(tokio::time::Duration::from_millis(250)).await;
            let proc = self.process.read().await;
            match &*proc {
                Some(p) if p.status != DesktopStatus::Starting => return,
                None => return,
                _ => {}
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Actual desktop — x11vnc (X11 sessions)
// ---------------------------------------------------------------------------

async fn run_actual_x11vnc(
    existing_display: &str,
    vnc_port: u16,
    process_ref: &Arc<RwLock<Option<DesktopProcess>>>,
    kill_rx: tokio::sync::oneshot::Receiver<()>,
) -> Result<(), String> {
    let mut cmd = Command::new("x11vnc");
    cmd.arg("-display")
        .arg(existing_display)
        .arg("-rfbport")
        .arg(vnc_port.to_string())
        .arg("-nopw")
        .arg("-forever")
        .arg("-shared")
        .arg("-noxdamage");

    if let Ok(xauth) = std::env::var("XAUTHORITY") {
        cmd.env("XAUTHORITY", &xauth);
        tracing::info!(xauth = %xauth, "Passing XAUTHORITY to x11vnc");
    } else {
        // Common fallback
        if let Ok(home) = std::env::var("HOME") {
            let default_xauth = format!("{home}/.Xauthority");
            if std::path::Path::new(&default_xauth).exists() {
                cmd.env("XAUTHORITY", &default_xauth);
                tracing::info!(xauth = %default_xauth, "Using default XAUTHORITY");
            }
        }
    }

    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    setup_process_group(&mut cmd);

    let mut child = cmd.spawn().map_err(|e| format!("Failed to start x11vnc: {e}"))?;
    let vnc_pid = child.id();

    // Spawn a task to drain stderr and log it
    let stderr = child.stderr.take();
    let stderr_task = if let Some(stderr) = stderr {
        Some(tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            let mut collected = Vec::new();
            while let Ok(Some(line)) = lines.next_line().await {
                tracing::debug!(target: "x11vnc", "{}", line);
                if collected.len() < 50 {
                    collected.push(line);
                }
            }
            collected
        }))
    } else {
        None
    };

    // Wait for the port to become reachable (up to 5 seconds)
    if !wait_for_port(vnc_port, 5000).await {
        // x11vnc probably crashed — collect stderr
        let stderr_lines = if let Some(task) = stderr_task {
            task.await.unwrap_or_default()
        } else {
            vec![]
        };
        let tail = stderr_lines
            .into_iter()
            .rev()
            .take(10)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>()
            .join("\n");
        let msg = if tail.is_empty() {
            format!("x11vnc failed to listen on port {vnc_port} within 5s (no stderr output)")
        } else {
            format!("x11vnc failed to start:\n{tail}")
        };
        kill_pids(process_ref).await;
        return Err(msg);
    }

    {
        let mut proc = process_ref.write().await;
        if let Some(p) = proc.as_mut() {
            p.status = DesktopStatus::Running;
            if let Some(pid) = vnc_pid {
                p.pids.push(pid);
            }
        }
    }

    tracing::info!(
        vnc_port = vnc_port,
        existing_display = existing_display,
        "Actual desktop (screen share) started"
    );

    let _ = kill_rx.await;
    tracing::info!("Stopping actual desktop screen share...");
    kill_pids(process_ref).await;
    Ok(())
}

// ---------------------------------------------------------------------------
// Actual desktop — wayvnc (Wayland/wlroots sessions)
// ---------------------------------------------------------------------------

async fn run_actual_wayvnc(
    vnc_port: u16,
    process_ref: &Arc<RwLock<Option<DesktopProcess>>>,
    kill_rx: tokio::sync::oneshot::Receiver<()>,
) -> Result<(), String> {
    let mut cmd = Command::new("wayvnc");
    cmd.arg("--render-cursor")
        .arg("0.0.0.0")
        .arg(vnc_port.to_string());
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    setup_process_group(&mut cmd);

    let mut child = cmd.spawn().map_err(|e| format!("Failed to start wayvnc: {e}"))?;
    let pid = child.id();

    let stderr = child.stderr.take();
    let stderr_task = if let Some(stderr) = stderr {
        Some(tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            let mut collected = Vec::new();
            while let Ok(Some(line)) = lines.next_line().await {
                tracing::debug!(target: "wayvnc", "{}", line);
                if collected.len() < 50 {
                    collected.push(line);
                }
            }
            collected
        }))
    } else {
        None
    };

    if !wait_for_port(vnc_port, 5000).await {
        let stderr_lines = if let Some(task) = stderr_task {
            task.await.unwrap_or_default()
        } else {
            vec![]
        };
        let tail = stderr_lines
            .into_iter()
            .rev()
            .take(10)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>()
            .join("\n");
        let msg = if tail.is_empty() {
            format!("wayvnc failed to listen on port {vnc_port} within 5s")
        } else {
            format!("wayvnc failed to start:\n{tail}")
        };
        kill_pids(process_ref).await;
        return Err(msg);
    }

    {
        let mut proc = process_ref.write().await;
        if let Some(p) = proc.as_mut() {
            p.status = DesktopStatus::Running;
            if let Some(p_id) = pid {
                p.pids.push(p_id);
            }
        }
    }

    tracing::info!(vnc_port = vnc_port, "wayvnc screen share started");

    let _ = kill_rx.await;
    tracing::info!("Stopping wayvnc screen share...");
    kill_pids(process_ref).await;
    Ok(())
}

// ---------------------------------------------------------------------------
// Actual desktop — krfb-virtualmonitor (KDE Wayland)
// ---------------------------------------------------------------------------

async fn run_actual_krfb(
    vnc_port: u16,
    password: &str,
    process_ref: &Arc<RwLock<Option<DesktopProcess>>>,
    kill_rx: tokio::sync::oneshot::Receiver<()>,
) -> Result<(), String> {
    ensure_krfb_desktop_file().await;

    let mut cmd = Command::new("krfb-virtualmonitor");
    cmd.arg("--name")
        .arg("pi-desktop")
        .arg("--resolution")
        .arg("1920x1080")
        .arg("--port")
        .arg(vnc_port.to_string())
        .arg("--password")
        .arg(password);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    setup_process_group(&mut cmd);

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start krfb-virtualmonitor: {e}"))?;
    let pid = child.id();

    let stderr = child.stderr.take();
    let stderr_task = if let Some(stderr) = stderr {
        Some(tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            let mut collected = Vec::new();
            while let Ok(Some(line)) = lines.next_line().await {
                tracing::debug!(target: "krfb", "{}", line);
                if collected.len() < 50 {
                    collected.push(line);
                }
            }
            collected
        }))
    } else {
        None
    };

    if !wait_for_port(vnc_port, 8000).await {
        let stderr_lines = if let Some(task) = stderr_task {
            task.await.unwrap_or_default()
        } else {
            vec![]
        };
        let tail = stderr_lines
            .into_iter()
            .rev()
            .take(10)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>()
            .join("\n");
        let msg = if tail.is_empty() {
            format!("krfb-virtualmonitor failed to listen on port {vnc_port} within 8s")
        } else {
            format!("krfb-virtualmonitor failed to start:\n{tail}")
        };
        kill_pids(process_ref).await;
        return Err(msg);
    }

    {
        let mut proc = process_ref.write().await;
        if let Some(p) = proc.as_mut() {
            p.status = DesktopStatus::Running;
            if let Some(p_id) = pid {
                p.pids.push(p_id);
            }
        }
    }

    tracing::info!(vnc_port = vnc_port, "krfb-virtualmonitor screen share started");

    let _ = kill_rx.await;
    tracing::info!("Stopping krfb-virtualmonitor...");
    kill_pids(process_ref).await;
    Ok(())
}

// ---------------------------------------------------------------------------
// Virtual desktop — Xvfb/Xvnc + DE on a new display
// ---------------------------------------------------------------------------

async fn run_virtual_desktop(
    backend_id: &str,
    de_command: &str,
    virt_display: &str,
    vnc_port: u16,
    resolution: &str,
    process_ref: &Arc<RwLock<Option<DesktopProcess>>>,
    kill_rx: tokio::sync::oneshot::Receiver<()>,
) -> Result<(), String> {
    let mut pids: Vec<u32> = Vec::new();

    match backend_id {
        "x11vnc" => {
            // --- Xvfb ---
            let mut xvfb = Command::new("Xvfb");
            xvfb.arg(virt_display)
                .arg("-screen")
                .arg("0")
                .arg(resolution)
                .arg("-ac");
            xvfb.stdout(std::process::Stdio::null());
            xvfb.stderr(std::process::Stdio::piped());
            setup_process_group(&mut xvfb);

            let mut xvfb_child =
                xvfb.spawn().map_err(|e| format!("Failed to start Xvfb: {e}"))?;
            if let Some(pid) = xvfb_child.id() {
                pids.push(pid);
            }

            // Drain Xvfb stderr in background so it never blocks
            let xvfb_stderr = xvfb_child.stderr.take();
            let xvfb_stderr_task = spawn_stderr_drain("Xvfb", xvfb_stderr);

            tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;

            // Check Xvfb is still alive
            if let Ok(Some(status)) = xvfb_child.try_wait() {
                let stderr = collect_stderr_task(xvfb_stderr_task).await;
                kill_pids_list(&pids).await;
                return Err(format!(
                    "Xvfb exited immediately with {status}\n{stderr}"
                ));
            }

            // --- x11vnc ---
            let mut vnc = Command::new("x11vnc");
            vnc.arg("-display")
                .arg(virt_display)
                .arg("-rfbport")
                .arg(vnc_port.to_string())
                .arg("-nopw")
                .arg("-forever")
                .arg("-shared");
            vnc.env_remove("WAYLAND_DISPLAY");
            vnc.env_remove("XDG_SESSION_TYPE");
            vnc.stdout(std::process::Stdio::null());
            vnc.stderr(std::process::Stdio::piped());
            setup_process_group(&mut vnc);

            let mut vnc_child =
                vnc.spawn().map_err(|e| format!("Failed to start x11vnc: {e}"))?;
            if let Some(pid) = vnc_child.id() {
                pids.push(pid);
            }

            let vnc_stderr = vnc_child.stderr.take();
            spawn_stderr_drain("x11vnc", vnc_stderr);
        }
        "tigervnc" | "turbovnc" => {
            let geo = resolution
                .rfind('x')
                .map(|i| &resolution[..i])
                .unwrap_or("1280x720");
            let mut vnc = Command::new("Xvnc");
            vnc.arg(virt_display)
                .arg("-geometry")
                .arg(geo)
                .arg("-depth")
                .arg("24")
                .arg("-rfbport")
                .arg(vnc_port.to_string())
                .arg("-SecurityTypes")
                .arg("None");
            vnc.stdout(std::process::Stdio::null());
            vnc.stderr(std::process::Stdio::piped());
            setup_process_group(&mut vnc);

            let mut vnc_child =
                vnc.spawn().map_err(|e| format!("Failed to start Xvnc: {e}"))?;
            if let Some(pid) = vnc_child.id() {
                pids.push(pid);
            }

            let vnc_stderr = vnc_child.stderr.take();
            spawn_stderr_drain("Xvnc", vnc_stderr);
        }
        _ => {
            kill_pids_list(&pids).await;
            return Err(format!("Unknown backend: {backend_id}"));
        }
    }

    // Wait for VNC port
    if !wait_for_port(vnc_port, 8000).await {
        kill_pids_list(&pids).await;
        return Err(format!(
            "VNC server failed to listen on port {vnc_port} within 8s. \
             Check server logs for details."
        ));
    }

    if !de_command.is_empty() {
        let mut de = Command::new("sh");
        de.arg("-c").arg(de_command);
        de.env("DISPLAY", virt_display);
        de.env_remove("WAYLAND_DISPLAY");
        de.env_remove("XDG_SESSION_TYPE");
        de.env_remove("DBUS_SESSION_BUS_ADDRESS");
        de.env_remove("XDG_SESSION_ID");
        de.env_remove("XDG_RUNTIME_DIR");
        de.stdout(std::process::Stdio::null());
        de.stderr(std::process::Stdio::piped());
        setup_process_group(&mut de);

        let mut de_child =
            de.spawn().map_err(|e| format!("Failed to start DE '{de_command}': {e}"))?;
        if let Some(pid) = de_child.id() {
            pids.push(pid);
        }

        let de_stderr = de_child.stderr.take();
        spawn_stderr_drain("DE", de_stderr);

        // Give the app a moment to create its window, then resize + focus it.
        // Without a WM, windows have no focus and may start tiny.
        let res_clone = resolution.to_string();
        let display_for_xdotool = virt_display.to_string();
        tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            let (w, h) = parse_resolution(&res_clone);
            // Resize, move, activate, and focus the first visible window
            let _ = Command::new("xdotool")
                .arg("search")
                .arg("--onlyvisible")
                .arg("--name")
                .arg("")
                .arg("windowmove")
                .arg("0")
                .arg("0")
                .arg("windowsize")
                .arg(w.to_string())
                .arg(h.to_string())
                .arg("windowactivate")
                .arg("windowfocus")
                .env("DISPLAY", &display_for_xdotool)
                .env_remove("WAYLAND_DISPLAY")
                .env_remove("XDG_SESSION_TYPE")
                .output()
                .await;
        });
    }

    {
        let mut proc = process_ref.write().await;
        if let Some(p) = proc.as_mut() {
            p.status = DesktopStatus::Running;
            p.pids = pids;
        }
    }

    tracing::info!(
        vnc_port = vnc_port,
        virt_display = virt_display,
        de_command = de_command,
        "Virtual desktop started"
    );

    let _ = kill_rx.await;
    tracing::info!("Stopping virtual desktop...");
    kill_pids(process_ref).await;
    Ok(())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn spawn_stderr_drain(
    label: &'static str,
    stderr: Option<tokio::process::ChildStderr>,
) -> Option<tokio::task::JoinHandle<Vec<String>>> {
    let stderr = stderr?;
    Some(tokio::spawn(async move {
        use tokio::io::{AsyncBufReadExt, BufReader};
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        let mut collected = Vec::new();
        while let Ok(Some(line)) = lines.next_line().await {
            tracing::debug!(target: "desktop", "[{label}] {line}");
            if collected.len() < 50 {
                collected.push(line);
            }
        }
        collected
    }))
}

async fn collect_stderr_task(
    task: Option<tokio::task::JoinHandle<Vec<String>>>,
) -> String {
    match task {
        Some(t) => t
            .await
            .unwrap_or_default()
            .into_iter()
            .rev()
            .take(10)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>()
            .join("\n"),
        None => String::new(),
    }
}

async fn wait_for_port(port: u16, timeout_ms: u64) -> bool {
    let deadline = tokio::time::Instant::now()
        + tokio::time::Duration::from_millis(timeout_ms);
    loop {
        if tokio::net::TcpStream::connect(format!("127.0.0.1:{port}"))
            .await
            .is_ok()
        {
            return true;
        }
        if tokio::time::Instant::now() >= deadline {
            return false;
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
    }
}

async fn kill_pids_list(pids: &[u32]) {
    #[cfg(unix)]
    {
        for pid in pids.iter().rev() {
            unsafe { libc::kill(-(*pid as i32), libc::SIGTERM); }
        }
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        for pid in pids.iter().rev() {
            unsafe { libc::kill(-(*pid as i32), libc::SIGKILL); }
        }
    }
}

async fn kill_pids(process_ref: &Arc<RwLock<Option<DesktopProcess>>>) {
    let pids = {
        let proc = process_ref.read().await;
        proc.as_ref().map(|p| p.pids.clone()).unwrap_or_default()
    };

    #[cfg(unix)]
    {
        // SIGTERM first (reverse order — DE, then VNC, then Xvfb)
        for pid in pids.iter().rev() {
            unsafe {
                libc::kill(-(*pid as i32), libc::SIGTERM);
            }
        }
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        // SIGKILL anything still alive
        for pid in pids.iter().rev() {
            unsafe {
                libc::kill(-(*pid as i32), libc::SIGKILL);
            }
        }
    }

    {
        let mut proc = process_ref.write().await;
        *proc = None;
    }
}

fn setup_process_group(cmd: &mut Command) {
    #[cfg(unix)]
    {
        let std_cmd = cmd.as_std_mut();
        use std::os::unix::process::CommandExt;
        unsafe {
            std_cmd.pre_exec(|| {
                libc::setsid();
                Ok(())
            });
        }
    }
}

async fn ensure_krfb_desktop_file() {
    let target_name = "org.kde.krfb-virtualmonitor.desktop";
    let source_name = "org.kde.krfb.virtualmonitor.desktop";

    if let Ok(home) = std::env::var("HOME") {
        let local_apps = format!("{home}/.local/share/applications");
        let target_path = format!("{local_apps}/{target_name}");

        if std::path::Path::new(&target_path).exists() {
            return;
        }

        let source_path = format!("/usr/share/applications/{source_name}");
        if !std::path::Path::new(&source_path).exists() {
            return;
        }

        if std::fs::create_dir_all(&local_apps).is_ok() {
            if let Ok(content) = std::fs::read_to_string(&source_path) {
                if std::fs::write(&target_path, &content).is_ok() {
                    tracing::info!(
                        "Created {target_path} to fix krfb portal registration"
                    );
                    let _ = Command::new("update-desktop-database")
                        .arg(&local_apps)
                        .output()
                        .await;
                }
            }
        }
    }
}

fn parse_resolution(res: &str) -> (u32, u32) {
    // "1280x720x24" or "1280x720" -> (1280, 720)
    let parts: Vec<&str> = res.split('x').collect();
    let w = parts.first().and_then(|s| s.parse().ok()).unwrap_or(1280);
    let h = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(720);
    (w, h)
}

fn generate_password() -> String {
    use rand::RngExt;
    let mut rng = rand::rng();
    (0..8)
        .map(|_| {
            let idx: u8 = rng.random_range(0..62);
            let c = match idx {
                0..26 => b'a' + idx,
                26..52 => b'A' + (idx - 26),
                _ => b'0' + (idx - 52),
            };
            c as char
        })
        .collect()
}

async fn which_exists(binary: &str) -> bool {
    Command::new("which")
        .arg(binary)
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false)
}

async fn find_free_display() -> u16 {
    for num in 10..100u16 {
        let lock = format!("/tmp/.X{num}-lock");
        if !std::path::Path::new(&lock).exists() {
            return num;
        }
    }
    99
}

async fn find_free_port(start: u16) -> u16 {
    for port in start..start + 100 {
        if tokio::net::TcpListener::bind(format!("127.0.0.1:{port}"))
            .await
            .is_ok()
        {
            return port;
        }
    }
    start
}
