use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::sync::oneshot;
use uuid::Uuid;

pub struct PairRequest {
    pub respond: oneshot::Sender<bool>,
}

pub struct PairingManager {
    inner: Arc<Mutex<PairingState>>,
    pending: Arc<Mutex<Option<PairRequest>>>,
    paired: Arc<std::sync::atomic::AtomicBool>,
}

struct PairingState {
    qr_id: String,
    created_at: Instant,
    ttl: Duration,
}

impl PairingManager {
    pub fn new(ttl_minutes: u64) -> Self {
        Self {
            inner: Arc::new(Mutex::new(PairingState {
                qr_id: Uuid::new_v4().to_string(),
                created_at: Instant::now(),
                ttl: Duration::from_secs(ttl_minutes * 60),
            })),
            pending: Arc::new(Mutex::new(None)),
            paired: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }
    }

    pub fn is_paired(&self) -> bool {
        self.paired.load(std::sync::atomic::Ordering::Relaxed)
    }

    pub fn mark_paired(&self) {
        self.paired.store(true, std::sync::atomic::Ordering::Relaxed);
    }

    pub fn current_qr_id(&self) -> String {
        let mut state = self.inner.lock().unwrap();
        if state.created_at.elapsed() >= state.ttl {
            state.qr_id = Uuid::new_v4().to_string();
            state.created_at = Instant::now();
        }
        state.qr_id.clone()
    }

    pub fn rotate(&self) -> String {
        let mut state = self.inner.lock().unwrap();
        state.qr_id = Uuid::new_v4().to_string();
        state.created_at = Instant::now();
        state.qr_id.clone()
    }

    pub fn validate_qr_id(&self, qr_id: &str) -> bool {
        let state = self.inner.lock().unwrap();
        state.qr_id == qr_id && state.created_at.elapsed() < state.ttl
    }

    pub fn invalidate_qr_id(&self) {
        let mut state = self.inner.lock().unwrap();
        state.qr_id = Uuid::new_v4().to_string();
        state.created_at = Instant::now();
    }

    pub fn submit_pair_request(&self, respond: oneshot::Sender<bool>) -> bool {
        let mut pending = self.pending.lock().unwrap();
        if pending.is_some() {
            return false;
        }
        *pending = Some(PairRequest { respond });
        true
    }

    pub fn take_pending(&self) -> Option<PairRequest> {
        self.pending.lock().unwrap().take()
    }
}

impl Clone for PairingManager {
    fn clone(&self) -> Self {
        Self {
            inner: Arc::clone(&self.inner),
            pending: Arc::clone(&self.pending),
            paired: Arc::clone(&self.paired),
        }
    }
}
