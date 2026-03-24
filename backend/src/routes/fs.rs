use axum::body::Body;
use axum::extract::{Multipart, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::Response;
use axum::Json;
use std::path::PathBuf;

use crate::server::state::AppState;
use crate::models::*;
use crate::routes::auth::require_auth;

const MAX_READ_BYTES: u64 = 1_048_576;
/// Max upload size: 50 MB
const MAX_UPLOAD_BYTES: usize = 50 * 1024 * 1024;

fn expand_tilde(path: &str) -> PathBuf {
    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home).join(rest);
        }
    } else if path == "~" {
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home);
        }
    }
    PathBuf::from(path)
}

fn collapse_tilde(path: &str) -> String {
    if let Some(home) = std::env::var_os("HOME") {
        let home_str = home.to_string_lossy();
        if path.starts_with(home_str.as_ref()) {
            return path.replacen(home_str.as_ref(), "~", 1);
        }
    }
    path.to_string()
}

macro_rules! auth_guard {
    ($state:expr, $headers:expr) => {
        if let Err((code, msg)) = require_auth($state, $headers).await {
            return (code, Json(ApiResponse::err(msg)));
        }
    };
}

#[derive(serde::Deserialize, utoipa::IntoParams)]
pub struct CompleteQuery {
    pub q: String,
}

#[derive(serde::Deserialize, utoipa::IntoParams)]
pub struct ListQuery {
    pub path: String,
}

#[derive(serde::Deserialize, utoipa::IntoParams)]
pub struct ReadQuery {
    pub path: String,
    pub offset: Option<u64>,
    pub limit: Option<u64>,
}

// ── autocomplete ──

#[utoipa::path(
    get,
    path = "/api/fs/complete",
    params(
        ("q" = String, Query, description = "Partial path to complete, e.g. ~/work or /home/omk")
    ),
    responses(
        (status = 200, description = "Path completions", body = Vec<PathCompletion>),
        (status = 401, description = "Unauthorized", body = ErrorBody),
    ),
    security(("bearer_auth" = [])),
    tag = "filesystem"
)]
pub async fn complete(
    State(state): State<AppState>,
    headers: HeaderMap,
    axum::extract::Query(params): axum::extract::Query<CompleteQuery>,
) -> (StatusCode, Json<ApiResponse<Vec<PathCompletion>>>) {
    auth_guard!(&state, &headers);

    let results = tokio::task::spawn_blocking(move || complete_path(&params.q))
        .await
        .unwrap();

    (StatusCode::OK, Json(ApiResponse::ok(results)))
}

fn complete_path(input: &str) -> Vec<PathCompletion> {
    let expanded = expand_tilde(input);

    let (parent, prefix) = if input.ends_with('/') || input.ends_with(std::path::MAIN_SEPARATOR) {
        (expanded.clone(), String::new())
    } else {
        let parent = expanded.parent().unwrap_or(&expanded).to_path_buf();
        let prefix = expanded
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_default();
        (parent, prefix)
    };

    let entries = match std::fs::read_dir(&parent) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };

    let mut results: Vec<PathCompletion> = entries
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().to_string();

            if !prefix.is_empty() && !name.to_lowercase().starts_with(&prefix.to_lowercase()) {
                return None;
            }

            if name.starts_with('.') && !prefix.starts_with('.') {
                return None;
            }

            let full_path = entry.path();
            let is_dir = full_path.is_dir();

            let display_path = if input.starts_with('~') {
                collapse_tilde(&full_path.to_string_lossy())
            } else {
                full_path.to_string_lossy().to_string()
            };

            Some(PathCompletion {
                path: display_path,
                is_dir,
            })
        })
        .collect();

    results.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.path.cmp(&b.path)));
    results.truncate(50);
    results
}

// ── list directory ──

#[utoipa::path(
    get,
    path = "/api/fs/list",
    params(("path" = String, Query, description = "Directory path (supports ~)")),
    responses(
        (status = 200, description = "Directory listing", body = FsListResponse),
        (status = 401, description = "Unauthorized", body = ErrorBody),
    ),
    security(("bearer_auth" = [])),
    tag = "filesystem"
)]
pub async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
    axum::extract::Query(params): axum::extract::Query<ListQuery>,
) -> (StatusCode, Json<ApiResponse<FsListResponse>>) {
    auth_guard!(&state, &headers);

    let path = params.path;
    match tokio::task::spawn_blocking(move || list_dir(&path)).await.unwrap() {
        Ok(r) => (StatusCode::OK, Json(ApiResponse::ok(r))),
        Err(e) => (StatusCode::BAD_REQUEST, Json(ApiResponse::err(e))),
    }
}

fn list_dir(path: &str) -> Result<FsListResponse, String> {
    let expanded = expand_tilde(path);
    let meta = std::fs::metadata(&expanded).map_err(|e| format!("{e}"))?;
    if !meta.is_dir() {
        return Err("Not a directory".to_string());
    }

    let read = std::fs::read_dir(&expanded).map_err(|e| format!("{e}"))?;

    let mut entries = Vec::new();
    for entry in read {
        let entry = entry.map_err(|e| format!("{e}"))?;
        let name = entry.file_name().to_string_lossy().to_string();
        let full = entry.path();
        let m = entry.metadata().map_err(|e| format!("{e}"))?;

        let modified = m
            .modified()
            .ok()
            .and_then(|t| {
                let dt: chrono::DateTime<chrono::Utc> = t.into();
                Some(dt.to_rfc3339())
            });

        entries.push(FsEntry {
            name,
            path: full.to_string_lossy().to_string(),
            is_dir: m.is_dir(),
            size: m.len(),
            modified,
        });
    }

    entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.name.cmp(&b.name)));
    let total = entries.len() as u32;

    Ok(FsListResponse {
        path: expanded.to_string_lossy().to_string(),
        entries,
        total,
    })
}

// ── read file ──

#[utoipa::path(
    get,
    path = "/api/fs/read",
    params(
        ("path" = String, Query, description = "File path (supports ~)"),
        ("offset" = Option<u64>, Query, description = "Byte offset to start reading (default: 0)"),
        ("limit" = Option<u64>, Query, description = "Max bytes to read (default/max: 1MB)")
    ),
    responses(
        (status = 200, description = "File content", body = FsReadResponse),
        (status = 401, description = "Unauthorized", body = ErrorBody),
    ),
    security(("bearer_auth" = [])),
    tag = "filesystem"
)]
pub async fn read(
    State(state): State<AppState>,
    headers: HeaderMap,
    axum::extract::Query(params): axum::extract::Query<ReadQuery>,
) -> (StatusCode, Json<ApiResponse<FsReadResponse>>) {
    auth_guard!(&state, &headers);

    let path = params.path;
    let offset = params.offset.unwrap_or(0);
    let limit = params.limit.unwrap_or(MAX_READ_BYTES).min(MAX_READ_BYTES);
    match tokio::task::spawn_blocking(move || read_file(&path, offset, limit)).await.unwrap() {
        Ok(r) => (StatusCode::OK, Json(ApiResponse::ok(r))),
        Err(e) => (StatusCode::BAD_REQUEST, Json(ApiResponse::err(e))),
    }
}

fn read_file(path: &str, offset: u64, limit: u64) -> Result<FsReadResponse, String> {
    use std::io::{Read, Seek, SeekFrom};

    let expanded = expand_tilde(path);
    let meta = std::fs::metadata(&expanded).map_err(|e| format!("{e}"))?;
    if meta.is_dir() {
        return Err("Path is a directory, not a file".to_string());
    }

    let file_size = meta.len();
    let mut file = std::fs::File::open(&expanded).map_err(|e| format!("{e}"))?;

    if offset > 0 {
        file.seek(SeekFrom::Start(offset)).map_err(|e| format!("{e}"))?;
    }

    let to_read = limit.min(file_size.saturating_sub(offset));
    let mut buf = vec![0u8; to_read as usize];
    let bytes_read = file.read(&mut buf).map_err(|e| format!("{e}"))?;
    buf.truncate(bytes_read);

    let content = String::from_utf8(buf).map_err(|_| "File contains non-UTF8 content".to_string())?;
    let truncated = offset + (bytes_read as u64) < file_size;

    Ok(FsReadResponse {
        path: expanded.to_string_lossy().to_string(),
        content,
        size: file_size,
        truncated,
        offset,
        length: bytes_read as u64,
    })
}

// ── create / write file ──

#[utoipa::path(
    post,
    path = "/api/fs/write",
    request_body = FsWriteRequest,
    responses(
        (status = 201, description = "File created/written", body = OperationResult),
        (status = 401, description = "Unauthorized", body = ErrorBody),
    ),
    security(("bearer_auth" = [])),
    tag = "filesystem"
)]
pub async fn write(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<FsWriteRequest>,
) -> (StatusCode, Json<ApiResponse<OperationResult>>) {
    auth_guard!(&state, &headers);

    let path = req.path;
    let content = req.content;
    match tokio::task::spawn_blocking(move || write_file(&path, &content)).await.unwrap() {
        Ok(_) => (
            StatusCode::CREATED,
            Json(ApiResponse::ok(OperationResult {
                operation: "write".to_string(),
                success: true,
                output: "File written".to_string(),
            })),
        ),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::ok(OperationResult {
                operation: "write".to_string(),
                success: false,
                output: e,
            })),
        ),
    }
}

fn write_file(path: &str, content: &str) -> Result<(), String> {
    let expanded = expand_tilde(path);
    if let Some(parent) = expanded.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("{e}"))?;
    }
    std::fs::write(&expanded, content).map_err(|e| format!("{e}"))
}

// ── mkdir ──

#[utoipa::path(
    post,
    path = "/api/fs/mkdir",
    request_body = FsMkdirRequest,
    responses(
        (status = 201, description = "Directory created", body = OperationResult),
        (status = 401, description = "Unauthorized", body = ErrorBody),
    ),
    security(("bearer_auth" = [])),
    tag = "filesystem"
)]
pub async fn mkdir(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<FsMkdirRequest>,
) -> (StatusCode, Json<ApiResponse<OperationResult>>) {
    auth_guard!(&state, &headers);

    let path = req.path;
    match tokio::task::spawn_blocking(move || {
        let expanded = expand_tilde(&path);
        std::fs::create_dir_all(&expanded).map_err(|e| format!("{e}"))
    })
    .await
    .unwrap()
    {
        Ok(_) => (
            StatusCode::CREATED,
            Json(ApiResponse::ok(OperationResult {
                operation: "mkdir".to_string(),
                success: true,
                output: "Directory created".to_string(),
            })),
        ),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::ok(OperationResult {
                operation: "mkdir".to_string(),
                success: false,
                output: e,
            })),
        ),
    }
}

// ── delete ──

#[utoipa::path(
    delete,
    path = "/api/fs/delete",
    request_body = FsDeleteRequest,
    responses(
        (status = 200, description = "File/directory deleted", body = OperationResult),
        (status = 401, description = "Unauthorized", body = ErrorBody),
    ),
    security(("bearer_auth" = [])),
    tag = "filesystem"
)]
pub async fn delete(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<FsDeleteRequest>,
) -> (StatusCode, Json<ApiResponse<OperationResult>>) {
    auth_guard!(&state, &headers);

    let path = req.path;
    let recursive = req.recursive.unwrap_or(false);
    match tokio::task::spawn_blocking(move || delete_path(&path, recursive)).await.unwrap() {
        Ok(_) => (
            StatusCode::OK,
            Json(ApiResponse::ok(OperationResult {
                operation: "delete".to_string(),
                success: true,
                output: "Deleted".to_string(),
            })),
        ),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::ok(OperationResult {
                operation: "delete".to_string(),
                success: false,
                output: e,
            })),
        ),
    }
}

fn delete_path(path: &str, recursive: bool) -> Result<(), String> {
    let expanded = expand_tilde(path);
    let meta = std::fs::metadata(&expanded).map_err(|e| format!("{e}"))?;
    if meta.is_dir() {
        if recursive {
            std::fs::remove_dir_all(&expanded).map_err(|e| format!("{e}"))
        } else {
            std::fs::remove_dir(&expanded).map_err(|e| format!("{e}"))
        }
    } else {
        std::fs::remove_file(&expanded).map_err(|e| format!("{e}"))
    }
}

// ── binary upload (multipart) ──

#[derive(serde::Deserialize, utoipa::IntoParams)]
pub struct UploadQuery {
    /// Target directory path (supports ~)
    pub path: String,
}

#[utoipa::path(
    post,
    path = "/api/fs/upload",
    params(("path" = String, Query, description = "Target directory path (supports ~)")),
    request_body(content_type = "multipart/form-data", content = Vec<u8>, description = "One or more files"),
    responses(
        (status = 200, description = "Upload results", body = FsUploadResponse),
        (status = 401, description = "Unauthorized", body = ErrorBody),
    ),
    security(("bearer_auth" = [])),
    tag = "filesystem"
)]
pub async fn upload(
    State(state): State<AppState>,
    headers: HeaderMap,
    axum::extract::Query(params): axum::extract::Query<UploadQuery>,
    mut multipart: Multipart,
) -> (StatusCode, Json<ApiResponse<FsUploadResponse>>) {
    auth_guard!(&state, &headers);

    let target_dir = expand_tilde(&params.path);
    if let Err(e) = std::fs::create_dir_all(&target_dir) {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::err(format!("Cannot create target dir: {e}"))),
        );
    }

    let mut results = Vec::new();

    while let Ok(Some(field)) = multipart.next_field().await {
        let file_name = match field.file_name() {
            Some(name) => name.to_string(),
            None => {
                results.push(FsUploadFileResult {
                    name: "(unknown)".to_string(),
                    path: String::new(),
                    size: 0,
                    success: false,
                    error: Some("Missing file name".to_string()),
                });
                continue;
            }
        };

        let dest = target_dir.join(&file_name);

        match field.bytes().await {
            Ok(bytes) => {
                if bytes.len() > MAX_UPLOAD_BYTES {
                    results.push(FsUploadFileResult {
                        name: file_name,
                        path: dest.to_string_lossy().to_string(),
                        size: bytes.len() as u64,
                        success: false,
                        error: Some(format!(
                            "File exceeds max size ({} MB)",
                            MAX_UPLOAD_BYTES / 1024 / 1024
                        )),
                    });
                    continue;
                }

                let size = bytes.len() as u64;
                let dest_clone = dest.clone();
                match tokio::task::spawn_blocking(move || {
                    std::fs::write(&dest_clone, &bytes)
                })
                .await
                .unwrap()
                {
                    Ok(_) => {
                        results.push(FsUploadFileResult {
                            name: file_name,
                            path: dest.to_string_lossy().to_string(),
                            size,
                            success: true,
                            error: None,
                        });
                    }
                    Err(e) => {
                        results.push(FsUploadFileResult {
                            name: file_name,
                            path: dest.to_string_lossy().to_string(),
                            size,
                            success: false,
                            error: Some(format!("{e}")),
                        });
                    }
                }
            }
            Err(e) => {
                results.push(FsUploadFileResult {
                    name: file_name,
                    path: dest.to_string_lossy().to_string(),
                    size: 0,
                    success: false,
                    error: Some(format!("Read error: {e}")),
                });
            }
        }
    }

    let total = results.len() as u32;
    let succeeded = results.iter().filter(|r| r.success).count() as u32;
    (
        StatusCode::OK,
        Json(ApiResponse::ok(FsUploadResponse {
            total,
            succeeded,
            files: results,
        })),
    )
}

// ── binary download ──

#[derive(serde::Deserialize, utoipa::IntoParams)]
pub struct DownloadQuery {
    /// File path (supports ~)
    pub path: String,
}

#[utoipa::path(
    get,
    path = "/api/fs/download",
    params(("path" = String, Query, description = "File path (supports ~)")),
    responses(
        (status = 200, description = "Raw file bytes", content_type = "application/octet-stream"),
        (status = 401, description = "Unauthorized", body = ErrorBody),
    ),
    security(("bearer_auth" = [])),
    tag = "filesystem"
)]
pub async fn download(
    State(state): State<AppState>,
    headers: HeaderMap,
    axum::extract::Query(params): axum::extract::Query<DownloadQuery>,
) -> Result<Response, (StatusCode, Json<ApiResponse<()>>)> {
    if let Err((code, msg)) = require_auth(&state, &headers).await {
        return Err((code, Json(ApiResponse::err(msg))));
    }

    let path = params.path.clone();
    let expanded = expand_tilde(&path);

    let (bytes, file_name) = tokio::task::spawn_blocking(move || {
        let meta = std::fs::metadata(&expanded).map_err(|e| format!("{e}"))?;
        if meta.is_dir() {
            return Err("Path is a directory".to_string());
        }
        let bytes = std::fs::read(&expanded).map_err(|e| format!("{e}"))?;
        let name = expanded
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| "file".to_string());
        Ok((bytes, name))
    })
    .await
    .unwrap()
    .map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::err(e)),
        )
    })?;

    let content_type = mime_guess::from_path(&file_name)
        .first_or_octet_stream()
        .to_string();

    let len = bytes.len();

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("content-type", HeaderValue::from_str(&content_type).unwrap_or(HeaderValue::from_static("application/octet-stream")))
        .header("content-length", len)
        .header(
            "content-disposition",
            HeaderValue::from_str(&format!("attachment; filename=\"{}\"", file_name))
                .unwrap_or(HeaderValue::from_static("attachment")),
        )
        .body(Body::from(bytes))
        .unwrap())
}
