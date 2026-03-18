import { create } from "zustand";
import type {
  AgentConnectionState,
  ChatMessage,
  StreamEvent,
  ToolCallInfo,
} from "../types";
import {
  parsePendingExtensionUiRequest,
  type PendingExtensionUiRequest,
} from "../extension-ui";
import { extractAgentMode, type AgentMode } from "../mode";

const PENDING_EXTENSION_UI_CLEAR_EVENTS = new Set([
  "turn_start",
  "message_start",
  "message_update",
  "message_end",
  "tool_execution_start",
  "tool_execution_update",
  "tool_execution_end",
  "turn_end",
  "agent_end",
  "session_process_exited",
]);

const DEFAULT_CONNECTION_STATE: AgentConnectionState = {
  status: "idle",
  retryAttempt: 0,
  nextRetryAt: null,
  lastDisconnectReason: null,
  disconnectedAt: null,
};

function findToolCall(
  messages: ChatMessage[],
  toolCallId: string,
): ToolCallInfo | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.toolCalls) {
      const tc = msg.toolCalls.find((t) => t.id === toolCallId);
      if (tc) return tc;
    }
  }
  return undefined;
}

function extractTextFromContent(content: any[] | undefined): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("");
}

function isModeSlashCommand(message: string): boolean {
  const firstToken = message.trim().split(/\s+/)[0];
  return firstToken === "/chat" || firstToken === "/plan";
}

function getStableMessageId(msg: any, role: ChatMessage["role"], index: number): string {
  const rawId =
    msg?.id ??
    msg?.messageId ??
    msg?.entryId ??
    msg?.entry_id ??
    null;

  if (rawId !== null && rawId !== undefined && rawId !== "") {
    return `${role}-${String(rawId)}`;
  }

  const timestamp =
    typeof msg?.timestamp === "number" ? msg.timestamp : "no-timestamp";
  return `${role}-${timestamp}-${index}`;
}

function convertPiMessages(piMessages: any[]): ChatMessage[] {
  const result: ChatMessage[] = [];

  for (const [index, msg] of piMessages.entries()) {
    if (msg.role === "user") {
      const text =
        typeof msg.content === "string"
          ? msg.content
          : extractTextFromContent(msg.content);
      result.push({
        id: getStableMessageId(msg, "user", index),
        role: "user",
        text,
        timestamp: msg.timestamp ?? Date.now(),
      });
    } else if (msg.role === "assistant") {
      const content = Array.isArray(msg.content) ? msg.content : [];
      const text = content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("");
      const thinking = content
        .filter((c: any) => c.type === "thinking")
        .map((c: any) => c.thinking)
        .join("");
      const toolCalls: ToolCallInfo[] = content
        .filter((c: any) => c.type === "toolCall")
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          arguments:
            typeof c.arguments === "string"
              ? c.arguments
              : JSON.stringify(c.arguments),
          status: "complete" as const,
        }));

      result.push({
        id: getStableMessageId(msg, "assistant", index),
        role: "assistant",
        text,
        thinking: thinking || undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        timestamp: msg.timestamp ?? Date.now(),
        model: msg.model,
        stopReason: msg.stopReason,
      });
    } else if (msg.role === "toolResult") {
      const lastAssistant = [...result]
        .reverse()
        .find((m) => m.role === "assistant");
      if (lastAssistant?.toolCalls) {
        const tc = lastAssistant.toolCalls.find(
          (t) => t.id === msg.toolCallId,
        );
        if (tc) {
          tc.result = extractTextFromContent(msg.content);
          tc.isError = msg.isError;
          tc.status = msg.isError ? "error" : "complete";
        }
      }
    }
  }

  return result;
}

interface AgentState {
  messages: Record<string, ChatMessage[]>;
  modes: Record<string, AgentMode | null | undefined>;
  pendingExtensionUiRequests: Record<
    string,
    PendingExtensionUiRequest | null | undefined
  >;
  streaming: Record<string, boolean>;
  lastEventId: number | null;
  connection: AgentConnectionState;
  reconnectNonce: number;
  pendingPrompt: { workspaceId: string; text: string } | null;

  processStreamEvent: (event: StreamEvent) => void;
  setHistoryMessages: (sessionId: string, piMessages: any[]) => void;
  clearMessages: (sessionId: string) => void;
  setConnectionState: (connection: AgentConnectionState) => void;
  requestReconnect: () => void;
  setPendingPrompt: (
    pending: { workspaceId: string; text: string } | null,
  ) => void;
  setPendingExtensionUiRequest: (
    sessionId: string,
    pending: PendingExtensionUiRequest | null,
  ) => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  messages: {},
  modes: {},
  pendingExtensionUiRequests: {},
  streaming: {},
  lastEventId: null,
  connection: DEFAULT_CONNECTION_STATE,
  reconnectNonce: 0,
  pendingPrompt: null,

  processStreamEvent: (event: StreamEvent) => {
    const { session_id: sessionId } = event;
    const piEvent = event.data;
    const eventType = event.type;

    set((state) => {
      const msgs = [...(state.messages[sessionId] ?? [])];
      const modes = { ...state.modes };
      const pendingExtensionUiRequests = {
        ...state.pendingExtensionUiRequests,
      };
      const streaming = { ...state.streaming };
      const streamedMode = extractAgentMode(piEvent);

      if (streamedMode) {
        modes[sessionId] = streamedMode;
      }

      if (PENDING_EXTENSION_UI_CLEAR_EVENTS.has(eventType)) {
        pendingExtensionUiRequests[sessionId] = null;
      }

      switch (eventType) {
        case "client_command": {
          if (
            ["prompt", "steer", "follow_up"].includes(piEvent.type) &&
            piEvent.message &&
            !isModeSlashCommand(piEvent.message)
          ) {
            msgs.push({
              id: `user-${event.id}`,
              role: "user",
              text: piEvent.message,
              timestamp: event.timestamp,
            });
          }
          if (piEvent.type === "extension_ui_response") {
            pendingExtensionUiRequests[sessionId] = null;
          }
          break;
        }

        case "agent_start": {
          streaming[sessionId] = true;
          break;
        }

        case "turn_start": {
          streaming[sessionId] = true;
          break;
        }

        case "agent_end": {
          streaming[sessionId] = false;
          break;
        }

        case "extension_ui_request": {
          if (piEvent.method === "setStatus" && piEvent.statusKey === "plan-mode") {
            const statusText =
              typeof piEvent.statusText === "string"
                ? piEvent.statusText.toLowerCase()
                : "";
            modes[sessionId] = statusText.includes("plan") ? "plan" : "chat";
          }
          const pending = parsePendingExtensionUiRequest(piEvent);
          if (pending) {
            pendingExtensionUiRequests[sessionId] = pending;
          }
          break;
        }

        case "message_start": {
          const msg = piEvent.message;
          if (msg?.role === "assistant") {
            msgs.push({
              id: `assistant-${event.id}`,
              role: "assistant",
              text: "",
              thinking: "",
              toolCalls: [],
              timestamp: event.timestamp,
              isStreaming: true,
              model: msg.model,
            });
          }
          break;
        }

        case "message_update": {
          const delta = piEvent.assistantMessageEvent;
          const lastIdx = msgs.findLastIndex(
            (m) => m.role === "assistant" && m.isStreaming,
          );
          if (lastIdx === -1 || !delta) break;

          const lastMsg = { ...msgs[lastIdx] };
          msgs[lastIdx] = lastMsg;

          switch (delta.type) {
            case "text_delta":
              lastMsg.text += delta.delta ?? "";
              break;
            case "thinking_delta":
              lastMsg.thinking = (lastMsg.thinking ?? "") + (delta.delta ?? "");
              break;
            case "toolcall_start": {
              const toolCalls = [...(lastMsg.toolCalls ?? [])];
              toolCalls.push({
                id: delta.partial?.id ?? `tc-${Date.now()}`,
                name: delta.partial?.name ?? "",
                arguments: "",
                status: "streaming",
              });
              lastMsg.toolCalls = toolCalls;
              break;
            }
            case "toolcall_delta": {
              const toolCalls = [...(lastMsg.toolCalls ?? [])];
              const last = toolCalls[toolCalls.length - 1];
              if (last) {
                toolCalls[toolCalls.length - 1] = {
                  ...last,
                  arguments: last.arguments + (delta.delta ?? ""),
                };
              }
              lastMsg.toolCalls = toolCalls;
              break;
            }
            case "toolcall_end": {
              const toolCalls = [...(lastMsg.toolCalls ?? [])];
              const last = toolCalls[toolCalls.length - 1];
              if (last && delta.toolCall) {
                toolCalls[toolCalls.length - 1] = {
                  ...last,
                  id: delta.toolCall.id,
                  name: delta.toolCall.name,
                  arguments:
                    typeof delta.toolCall.arguments === "string"
                      ? delta.toolCall.arguments
                      : JSON.stringify(delta.toolCall.arguments),
                  status: "pending",
                };
              }
              lastMsg.toolCalls = toolCalls;
              break;
            }
            case "done":
              lastMsg.isStreaming = false;
              lastMsg.stopReason =
                delta.reason ?? piEvent.message?.stopReason;
              break;
            case "error":
              lastMsg.isStreaming = false;
              lastMsg.stopReason =
                delta.reason ?? piEvent.message?.stopReason ?? "error";
              break;
          }
          break;
        }

        case "message_end": {
          const lastIdx = msgs.findLastIndex(
            (m) => m.role === "assistant" && m.isStreaming,
          );
          if (lastIdx !== -1) {
            msgs[lastIdx] = {
              ...msgs[lastIdx],
              isStreaming: false,
              stopReason: piEvent.message?.stopReason,
            };
          }
          break;
        }

        case "tool_execution_start": {
          const tc = findToolCall(msgs, piEvent.toolCallId);
          if (tc) tc.status = "running";
          break;
        }

        case "tool_execution_update": {
          const tc = findToolCall(msgs, piEvent.toolCallId);
          if (tc && piEvent.partialResult?.content) {
            tc.partialResult = extractTextFromContent(
              piEvent.partialResult.content,
            );
          }
          break;
        }

        case "tool_execution_end": {
          const tc = findToolCall(msgs, piEvent.toolCallId);
          if (tc) {
            tc.status = piEvent.isError ? "error" : "complete";
            tc.result = extractTextFromContent(piEvent.result?.content);
            tc.isError = piEvent.isError;
          }
          break;
        }

        case "session_process_exited": {
          streaming[sessionId] = false;
          break;
        }
      }

      return {
        messages: { ...state.messages, [sessionId]: msgs },
        modes,
        pendingExtensionUiRequests,
        streaming,
        lastEventId: event.id,
      };
    });
  },

  setHistoryMessages: (sessionId: string, piMessages: any[]) => {
    const existing = get().messages[sessionId];
    const converted = convertPiMessages(piMessages);
    if (!existing || existing.length === 0) {
      set((state) => ({
        messages: { ...state.messages, [sessionId]: converted },
      }));
      return;
    }
    const isStreaming = get().streaming[sessionId];
    if (isStreaming) return;
    if (converted.length <= existing.length) return;
    set((state) => ({
      messages: { ...state.messages, [sessionId]: converted },
    }));
  },

  clearMessages: (sessionId: string) => {
    set((state) => {
      const { [sessionId]: _, ...rest } = state.messages;
      const { [sessionId]: ___, ...modeRest } = state.modes;
      const { [sessionId]: __, ...pendingRest } =
        state.pendingExtensionUiRequests;
      return {
        messages: rest,
        modes: modeRest,
        pendingExtensionUiRequests: pendingRest,
      };
    });
  },

  setConnectionState: (connection) => set({ connection }),

  requestReconnect: () =>
    set((state) => ({ reconnectNonce: state.reconnectNonce + 1 })),

  setPendingPrompt: (pending) => set({ pendingPrompt: pending }),

  setPendingExtensionUiRequest: (sessionId, pending) =>
    set((state) => ({
      pendingExtensionUiRequests: {
        ...state.pendingExtensionUiRequests,
        [sessionId]: pending,
      },
    })),
}));
