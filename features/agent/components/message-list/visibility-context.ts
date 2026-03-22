import { createContext, useContext } from "react";

const EMPTY_SET = new Set<string>();

/**
 * Tracks which message IDs are currently visible in the FlatList viewport.
 * Child components use this to detach expensive content when off-screen.
 */
export const VisibleMessagesContext = createContext<Set<string>>(EMPTY_SET);

export function useVisibleMessages(): Set<string> {
  return useContext(VisibleMessagesContext);
}

/**
 * The ID of the parent message, set by AssistantMessage so child
 * tool-call components can check their own visibility.
 */
export const MessageIdContext = createContext<string | null>(null);

/**
 * Returns true when the parent message is currently visible in the viewport.
 * Defaults to true when no visibility tracking is active (e.g. web).
 */
export function useIsMessageVisible(): boolean {
  const visibleIds = useVisibleMessages();
  const messageId = useContext(MessageIdContext);
  // If context isn't wired up, assume visible
  if (!messageId || visibleIds.size === 0) return true;
  return visibleIds.has(messageId);
}
