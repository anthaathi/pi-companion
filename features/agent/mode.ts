export type AgentMode = "chat" | "plan";

export function normalizeAgentMode(value: unknown): AgentMode | null {
  if (typeof value !== "string") return null;
  const mode = value.trim().toLowerCase();
  if (mode === "chat" || mode === "plan") {
    return mode;
  }
  return null;
}

export function extractAgentMode(
  data: Record<string, any> | undefined,
): AgentMode | null {
  if (!data) return null;
  return (
    normalizeAgentMode(data.mode) ??
    normalizeAgentMode(data.currentMode) ??
    normalizeAgentMode(data.promptMode) ??
    normalizeAgentMode(data.chatMode) ??
    normalizeAgentMode(data.followUpMode) ??
    normalizeAgentMode(data.steeringMode)
  );
}

export function formatAgentModeLabel(mode: AgentMode): string {
  return mode === "plan" ? "Plan" : "Chat";
}
