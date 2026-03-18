use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

use crate::services::agent::AgentSessionInfo;

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateAgentSessionRequest {
    pub workspace_id: String,
    pub session_path: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct TouchAgentSessionRequest {
    pub session_file: String,
    pub workspace_id: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AgentSessionIdRequest {
    pub session_id: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AgentSessionCommandResponse {
    pub result: Value,
    pub session: AgentSessionInfo,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AgentPromptRequest {
    pub session_id: String,
    pub message: String,
    pub images: Option<Vec<ImageContent>>,
    pub streaming_behavior: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ImageContent {
    #[serde(rename = "type")]
    pub content_type: String,
    pub data: String,
    #[serde(rename = "mimeType")]
    pub mime_type: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AgentMessageRequest {
    pub session_id: String,
    pub message: String,
    pub images: Option<Vec<ImageContent>>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AgentSetModelRequest {
    pub session_id: String,
    pub provider: String,
    #[serde(rename = "modelId")]
    pub model_id: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AgentSetThinkingRequest {
    pub session_id: String,
    pub level: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AgentSetModeRequest {
    pub session_id: String,
    pub mode: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AgentCompactRequest {
    pub session_id: String,
    #[serde(rename = "customInstructions")]
    pub custom_instructions: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AgentSetBoolRequest {
    pub session_id: String,
    pub enabled: bool,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AgentBashRequest {
    pub session_id: String,
    pub command: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AgentExportHtmlRequest {
    pub session_id: String,
    #[serde(rename = "outputPath")]
    pub output_path: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AgentSwitchSessionRequest {
    pub session_id: String,
    #[serde(rename = "sessionPath")]
    pub session_path: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AgentForkRequest {
    pub session_id: String,
    #[serde(rename = "entryId")]
    pub entry_id: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AgentSetSessionNameRequest {
    pub session_id: String,
    pub name: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AgentNewSessionRequest {
    pub session_id: String,
    #[serde(rename = "parentSession")]
    pub parent_session: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AgentExtensionUiResponseRequest {
    pub session_id: String,
    pub id: String,
    pub value: Option<Value>,
    pub confirmed: Option<bool>,
    pub cancelled: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct StreamQuery {
    pub from: Option<u64>,
}
