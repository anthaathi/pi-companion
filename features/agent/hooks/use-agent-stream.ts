import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import EventSource from "react-native-sse";
import { client } from "@/features/api/generated/client.gen";
import { useAgentStore } from "../store";
import type { StreamEvent } from "../types";

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

export function useAgentStream() {
  const queryClient = useQueryClient();
  const lastEventIdRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const seenSessionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;

    function cleanup() {
      if (es) {
        es.removeAllEventListeners();
        es.close();
        es = null;
      }
    }

    function scheduleReconnect() {
      if (!mounted) return;
      useAgentStore.getState().setConnected(false);
      const delay = Math.min(
        RECONNECT_BASE_MS * Math.pow(2, retryCountRef.current),
        RECONNECT_MAX_MS,
      );
      retryCountRef.current++;
      reconnectTimer = setTimeout(connect, delay);
    }

    function connect() {
      if (!mounted) return;
      cleanup();

      const config = client.getConfig();
      const baseUrl = (config as any).baseUrl ?? "";
      const auth = (config as any).auth;
      if (!baseUrl || !auth) {
        reconnectTimer = setTimeout(connect, 2000);
        return;
      }

      const fromParam =
        lastEventIdRef.current !== null
          ? `?from=${lastEventIdRef.current}`
          : "";
      const url = `${baseUrl}/api/stream${fromParam}`;

      es = new EventSource(url, {
        headers: {
          Authorization: {
            toString: () => `Bearer ${auth}`,
          },
        },
        pollingInterval: 0,
        timeoutBeforeConnection: 0,
      });

      es.addEventListener("open", () => {
        if (!mounted) return;
        useAgentStore.getState().setConnected(true);
        retryCountRef.current = 0;
      });

      es.addEventListener("message", (event) => {
        if (!mounted || !event.data) return;
        try {
          const streamEvent: StreamEvent = JSON.parse(event.data);
          lastEventIdRef.current = streamEvent.id;
          useAgentStore.getState().processStreamEvent(streamEvent);

          const sid = streamEvent.session_id;
          const eventType = streamEvent.type;

          if (eventType === "agent_end" && sid && !seenSessionsRef.current.has(sid)) {
            seenSessionsRef.current.add(sid);
            queryClient.refetchQueries({
              predicate: (query) =>
                query.queryKey[0] === "sessions",
            });
          }
        } catch {}
      });

      es.addEventListener("error", () => {
        if (!mounted) return;
        cleanup();
        scheduleReconnect();
      });

      es.addEventListener("close", () => {
        if (!mounted) return;
        cleanup();
        scheduleReconnect();
      });
    }

    connect();

    return () => {
      mounted = false;
      cleanup();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      useAgentStore.getState().setConnected(false);
    };
  }, []);
}
