use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use serde_json::Value;
use tokio::sync::{mpsc, RwLock};
use tokio::time::Instant;
use uuid::Uuid;

const PREVIOUS_SESSION_GRACE_SECS: u64 = 10;

struct SessionState {
    active: Option<String>,
    previous: Option<String>,
    previous_deadline: Option<Instant>,
}

pub struct SseConnection {
    session_state: RwLock<SessionState>,
    pub inject_tx: mpsc::UnboundedSender<Value>,
}

impl SseConnection {
    pub async fn is_session_receiving_deltas(&self, session_id: &str) -> bool {
        let state = self.session_state.read().await;
        if state.active.as_deref() == Some(session_id) {
            return true;
        }
        if state.previous.as_deref() == Some(session_id) {
            if let Some(deadline) = state.previous_deadline {
                return Instant::now() < deadline;
            }
        }
        false
    }

    pub async fn set_active(&self, session_id: Option<String>) {
        let mut state = self.session_state.write().await;
        let old_active = state.active.take();

        if let Some(ref old) = old_active {
            if session_id.as_deref() != Some(old.as_str()) {
                state.previous = Some(old.clone());
                state.previous_deadline =
                    Some(Instant::now() + Duration::from_secs(PREVIOUS_SESSION_GRACE_SECS));
            }
        }

        state.active = session_id;
    }
}

#[derive(Clone)]
pub struct SseConnectionRegistry {
    connections: Arc<RwLock<HashMap<String, Arc<SseConnection>>>>,
}

impl SseConnectionRegistry {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn register(&self) -> (String, Arc<SseConnection>, mpsc::UnboundedReceiver<Value>) {
        let id = Uuid::new_v4().to_string();
        let (inject_tx, inject_rx) = mpsc::unbounded_channel();
        let conn = Arc::new(SseConnection {
            session_state: RwLock::new(SessionState {
                active: None,
                previous: None,
                previous_deadline: None,
            }),
            inject_tx,
        });
        self.connections.write().await.insert(id.clone(), conn.clone());
        (id, conn, inject_rx)
    }

    pub async fn unregister(&self, connection_id: &str) {
        self.connections.write().await.remove(connection_id);
    }

    pub async fn get(&self, connection_id: &str) -> Option<Arc<SseConnection>> {
        self.connections.read().await.get(connection_id).cloned()
    }
}
