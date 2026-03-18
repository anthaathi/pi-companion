use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;

use crate::app::AppState;
use crate::models::{ApiResponse, ErrorBody, LoginRequest, LoginResponse, PairRequest, PairResponse};

#[utoipa::path(
    post,
    path = "/api/auth/login",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Login successful", body = LoginResponse),
        (status = 401, description = "Invalid credentials", body = ErrorBody),
    ),
    tag = "auth"
)]
pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> (StatusCode, Json<ApiResponse<LoginResponse>>) {
    if req.username != state.config.auth.username {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ApiResponse::err("Invalid credentials")),
        );
    }

    let valid = bcrypt::verify(&req.password, &state.config.auth.password_hash).unwrap_or(false);
    if !valid {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ApiResponse::err("Invalid credentials")),
        );
    }

    match state
        .db
        .create_session(&req.username, state.config.auth.session_ttl_hours)
    {
        Ok((token, expires_at)) => {
            let expires = chrono::DateTime::parse_from_rfc3339(&expires_at)
                .unwrap()
                .with_timezone(&chrono::Utc);
            (
                StatusCode::OK,
                Json(ApiResponse::ok(LoginResponse {
                    token,
                    expires_at: expires,
                })),
            )
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(format!("Session creation failed: {e}"))),
        ),
    }
}

#[utoipa::path(
    post,
    path = "/api/auth/logout",
    responses(
        (status = 200, description = "Logged out"),
        (status = 401, description = "Unauthorized", body = ErrorBody),
    ),
    security(("bearer_auth" = [])),
    tag = "auth"
)]
pub async fn logout(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> (StatusCode, Json<ApiResponse<String>>) {
    let token = match extract_token(&headers) {
        Some(t) => t,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(ApiResponse::err("Missing authorization token")),
            )
        }
    };

    match state.db.delete_session(&token) {
        Ok(_) => (StatusCode::OK, Json(ApiResponse::ok("Logged out".to_string()))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(format!("Logout failed: {e}"))),
        ),
    }
}

#[utoipa::path(
    get,
    path = "/api/auth/session",
    responses(
        (status = 200, description = "Session valid"),
        (status = 401, description = "Session invalid or expired", body = ErrorBody),
    ),
    security(("bearer_auth" = [])),
    tag = "auth"
)]
pub async fn check_session(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> (StatusCode, Json<ApiResponse<String>>) {
    let token = match extract_token(&headers) {
        Some(t) => t,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(ApiResponse::err("Missing authorization token")),
            )
        }
    };

    match state.db.validate_session(&token) {
        Ok(Some(username)) => (
            StatusCode::OK,
            Json(ApiResponse::ok(format!("Session valid for user: {username}"))),
        ),
        Ok(None) => (
            StatusCode::UNAUTHORIZED,
            Json(ApiResponse::err("Session invalid or expired")),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(format!("Session check failed: {e}"))),
        ),
    }
}

#[utoipa::path(
    post,
    path = "/api/auth/pair",
    request_body = PairRequest,
    responses(
        (status = 200, description = "Pairing accepted, session token returned", body = PairResponse),
        (status = 400, description = "Invalid or expired QR ID", body = ErrorBody),
        (status = 408, description = "Pairing rejected by server operator", body = ErrorBody),
        (status = 409, description = "Another pairing request is already pending", body = ErrorBody),
    ),
    tag = "auth"
)]
pub async fn pair(
    State(state): State<AppState>,
    Json(req): Json<PairRequest>,
) -> (StatusCode, Json<ApiResponse<PairResponse>>) {
    if !state.pairing.validate_qr_id(&req.qr_id) {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::err("Invalid or expired QR ID")),
        );
    }

    let (tx, rx) = tokio::sync::oneshot::channel();

    if !state.pairing.submit_pair_request(tx) {
        return (
            StatusCode::CONFLICT,
            Json(ApiResponse::err("Another pairing request is already pending")),
        );
    }

    tracing::info!("Pairing request received — waiting for terminal approval...");

    match rx.await {
        Ok(true) => {
            state.pairing.mark_paired();
            state.pairing.invalidate_qr_id();
            match state
                .db
                .create_session(&state.config.auth.username, state.config.auth.session_ttl_hours)
            {
                Ok((token, expires_at)) => {
                    let expires = chrono::DateTime::parse_from_rfc3339(&expires_at)
                        .unwrap()
                        .with_timezone(&chrono::Utc);
                    (
                        StatusCode::OK,
                        Json(ApiResponse::ok(PairResponse {
                            token,
                            expires_at: expires,
                        })),
                    )
                }
                Err(e) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ApiResponse::err(format!("Session creation failed: {e}"))),
                ),
            }
        }
        Ok(false) => (
            StatusCode::REQUEST_TIMEOUT,
            Json(ApiResponse::err("Pairing rejected by server operator")),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err("Pairing request cancelled")),
        ),
    }
}

pub fn extract_token(headers: &axum::http::HeaderMap) -> Option<String> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|s| s.to_string())
}

pub async fn require_auth(
    state: &AppState,
    headers: &axum::http::HeaderMap,
) -> Result<String, (StatusCode, String)> {
    let token = extract_token(headers)
        .ok_or((StatusCode::UNAUTHORIZED, "Missing authorization token".to_string()))?;

    state
        .db
        .validate_session(&token)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Auth check failed: {e}")))?
        .ok_or((StatusCode::UNAUTHORIZED, "Session invalid or expired".to_string()))
}
