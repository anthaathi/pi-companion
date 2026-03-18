import { create } from "zustand";
import type { ChatMessage, StreamEvent, ToolCallInfo } from "../types";

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
  streaming: Record<string, boolean>;
  lastEventId: number | null;
  connected: boolean;
  pendingPrompt: { workspaceId: string; text: string } | null;

  processStreamEvent: (event: StreamEvent) => void;
  setHistoryMessages: (sessionId: string, piMessages: any[]) => void;
  clearMessages: (sessionId: string) => void;
  setConnected: (connected: boolean) => void;
  setPendingPrompt: (
    pending: { workspaceId: string; text: string } | null,
  ) => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  messages: {},
  streaming: {},
  lastEventId: null,
  connected: false,
  pendingPrompt: null,

  processStreamEvent: (event: StreamEvent) => {
    const { session_id: sessionId } = event;
    const piEvent = event.data;
    const eventType = event.type;

    set((state) => {
      const msgs = [...(state.messages[sessionId] ?? [])];
      const streaming = { ...state.streaming };

      switch (eventType) {
        case "client_command": {
          if (piEvent.type === "prompt" && piEvent.message) {
            msgs.push({
              id: `user-${event.id}`,
              role: "user",
              text: piEvent.message,
              timestamp: event.timestamp,
            });
          }
          break;
        }

        case "agent_start": {
          streaming[sessionId] = true;
          break;
        }

        case "agent_end": {
          streaming[sessionId] = false;
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
      }

      return {
        messages: { ...state.messages, [sessionId]: msgs },
        streaming,
        lastEventId: event.id,
      };
    });
  },

  setHistoryMessages: (sessionId: string, piMessages: any[]) => {
    const converted = convertPiMessages(piMessages);
    set((state) => ({
      messages: { ...state.messages, [sessionId]: converted },
    }));
  },

  clearMessages: (sessionId: string) => {
    set((state) => {
      const { [sessionId]: _, ...rest } = state.messages;
      return { messages: rest };
    });
  },

  setConnected: (connected: boolean) => set({ connected }),

  setPendingPrompt: (pending) => set({ pendingPrompt: pending }),
}));
