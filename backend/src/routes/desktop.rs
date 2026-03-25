use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use futures_util::{SinkExt, StreamExt};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use crate::models::ApiResponse;
use crate::routes::auth;
use crate::server::state::AppState;
use crate::services::desktop::{
    CurrentDesktopInfo, DesktopEnvironment, DesktopInfo, DesktopMode, VncBackend,
};

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct DesktopBackendsResponse {
    pub backends: Vec<VncBackend>,
    pub desktop_environments: Vec<DesktopEnvironment>,
    pub current_desktop: CurrentDesktopInfo,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct StartDesktopRequest {
    pub mode: DesktopMode,
    pub backend_id: Option<String>,
    pub de_id: Option<String>,
    pub resolution: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    pub access_token: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/desktop/backends",
    responses(
        (status = 200, description = "Available backends, DEs, and current desktop info", body = DesktopBackendsResponse),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer_auth" = [])),
    tag = "desktop"
)]
pub async fn get_backends(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> (StatusCode, Json<ApiResponse<DesktopBackendsResponse>>) {
    if let Err((code, msg)) = auth::require_auth(&state, &headers).await {
        return (code, Json(ApiResponse::err(msg)));
    }

    let backends = state.desktop.detect_backends().await;
    let des = state.desktop.detect_desktop_environments().await;
    let current_desktop = state.desktop.detect_current_desktop().await;

    (
        StatusCode::OK,
        Json(ApiResponse::ok(DesktopBackendsResponse {
            backends,
            desktop_environments: des,
            current_desktop,
        })),
    )
}

#[utoipa::path(
    get,
    path = "/api/desktop/status",
    responses(
        (status = 200, description = "Desktop status", body = DesktopInfo),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer_auth" = [])),
    tag = "desktop"
)]
pub async fn get_status(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> (StatusCode, Json<ApiResponse<DesktopInfo>>) {
    if let Err((code, msg)) = auth::require_auth(&state, &headers).await {
        return (code, Json(ApiResponse::err(msg)));
    }

    let info = state.desktop.status().await;
    (StatusCode::OK, Json(ApiResponse::ok(info)))
}

#[utoipa::path(
    post,
    path = "/api/desktop/start",
    request_body = StartDesktopRequest,
    responses(
        (status = 200, description = "Desktop started", body = DesktopInfo),
        (status = 400, description = "Failed to start"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer_auth" = [])),
    tag = "desktop"
)]
pub async fn start_desktop(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<StartDesktopRequest>,
) -> (StatusCode, Json<ApiResponse<DesktopInfo>>) {
    if let Err((code, msg)) = auth::require_auth(&state, &headers).await {
        return (code, Json(ApiResponse::err(msg)));
    }

    let result = match req.mode {
        DesktopMode::Actual => state.desktop.start_actual().await,
        DesktopMode::Virtual => {
            let backend_id = req.backend_id.as_deref().unwrap_or("x11vnc");
            let de_id = req.de_id.as_deref().unwrap_or("xfce");
            state
                .desktop
                .start_virtual(backend_id, de_id, req.resolution.as_deref())
                .await
        }
    };

    match result {
        Ok(info) => (StatusCode::OK, Json(ApiResponse::ok(info))),
        Err(e) => (StatusCode::BAD_REQUEST, Json(ApiResponse::err(e))),
    }
}

#[utoipa::path(
    post,
    path = "/api/desktop/stop",
    responses(
        (status = 200, description = "Desktop stopped", body = DesktopInfo),
        (status = 400, description = "Failed to stop"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer_auth" = [])),
    tag = "desktop"
)]
pub async fn stop_desktop(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> (StatusCode, Json<ApiResponse<DesktopInfo>>) {
    if let Err((code, msg)) = auth::require_auth(&state, &headers).await {
        return (code, Json(ApiResponse::err(msg)));
    }

    match state.desktop.stop().await {
        Ok(info) => (StatusCode::OK, Json(ApiResponse::ok(info))),
        Err(e) => (StatusCode::BAD_REQUEST, Json(ApiResponse::err(e))),
    }
}

pub async fn vnc_websocket(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<WsQuery>,
) -> impl IntoResponse {
    let access_token = auth::extract_token(&headers).or(params.access_token);

    let token = match access_token {
        Some(t) => t,
        None => return StatusCode::UNAUTHORIZED.into_response(),
    };

    if auth::validate_access_token(&state, &token).is_err() {
        return StatusCode::UNAUTHORIZED.into_response();
    }

    let vnc_port = match state.desktop.get_vnc_port().await {
        Some(port) => port,
        None => return StatusCode::SERVICE_UNAVAILABLE.into_response(),
    };

    ws.protocols(["binary"])
        .on_upgrade(move |socket| handle_vnc_proxy(socket, vnc_port))
}

async fn handle_vnc_proxy(ws: WebSocket, vnc_port: u16) {
    let tcp = match TcpStream::connect(format!("127.0.0.1:{vnc_port}")).await {
        Ok(stream) => stream,
        Err(e) => {
            tracing::error!("Failed to connect to VNC server at port {vnc_port}: {e}");
            return;
        }
    };

    let (mut tcp_read, mut tcp_write) = tcp.into_split();
    let (mut ws_sink, mut ws_stream) = ws.split();

    let tcp_to_ws = tokio::spawn(async move {
        let mut buf = [0u8; 65536];
        loop {
            match tcp_read.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => {
                    if ws_sink
                        .send(Message::Binary(buf[..n].to_vec().into()))
                        .await
                        .is_err()
                    {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });

    let ws_to_tcp = tokio::spawn(async move {
        while let Some(msg) = ws_stream.next().await {
            match msg {
                Ok(Message::Binary(data)) => {
                    if tcp_write.write_all(&data).await.is_err() {
                        break;
                    }
                }
                Ok(Message::Close(_)) | Err(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = tcp_to_ws => {}
        _ = ws_to_tcp => {}
    }
}
