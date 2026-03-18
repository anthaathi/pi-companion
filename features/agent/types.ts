export interface StreamEvent {
  id: number;
  session_id: string;
  type: string;
  data: Record<string, any>;
  timestamp: number;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: string;
  status: "streaming" | "pending" | "running" | "complete" | "error";
  result?: string;
  isError?: boolean;
  partialResult?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  thinking?: string;
  toolCalls?: ToolCallInfo[];
  timestamp: number;
  isStreaming?: boolean;
  model?: string;
  stopReason?: string;
}
