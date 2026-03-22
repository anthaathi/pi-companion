import { useEffect, useRef } from "react";
import { usePiClient } from "./context";
import type { StreamEventEnvelope } from "../types/stream-events";

export interface TurnEndEvent {
  sessionId: string;
  workspaceId?: string;
  timestamp: number;
  envelope: StreamEventEnvelope;
}

/**
 * Fires `onTurnEnd` whenever any session finishes a turn (`agent_end`).
 *
 * The callback receives the session id so the consumer can decide whether
 * to show a banner, fire haptics, etc. based on which session is active.
 */
export function useTurnEnd(onTurnEnd: (event: TurnEndEvent) => void): void {
  const client = usePiClient();
  const callbackRef = useRef(onTurnEnd);
  callbackRef.current = onTurnEnd;

  useEffect(() => {
    const subscription = client.events$.subscribe((envelope) => {
      if (envelope.type !== "agent_end") return;
      callbackRef.current({
        sessionId: envelope.session_id,
        workspaceId: envelope.workspace_id,
        timestamp: envelope.timestamp,
        envelope,
      });
    });
    return () => subscription.unsubscribe();
  }, [client]);
}
