import { useCallback, useEffect, useRef, useState } from "react";
import { usePiClient } from "./context";
import type { ModelInfo, AgentStateData } from "../types/stream-events";
import type { AgentMode } from "../types/chat-message";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

export interface AgentConfigHandle {
  state: AgentStateData | null;
  models: ModelInfo[] | null;
  isLoading: boolean;
  error: string | null;
  setModel: (params: { provider: string; modelId: string }) => Promise<void>;
  setThinkingLevel: (level: string) => Promise<void>;
  setMode: (mode: AgentMode) => Promise<void>;
  reload: () => Promise<void>;
  retry: () => void;
}

export function useAgentConfig(sessionId: string | null): AgentConfigHandle {
  const client = usePiClient();
  const [state, setState] = useState<AgentStateData | null>(null);
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attemptRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef(sessionId);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // Subscribe to agent_state from SSE
  useEffect(() => {
    if (!sessionId) {
      setState(null);
      return;
    }

    const sub = client.agentState$(sessionId).subscribe((agentState) => {
      if (agentState && sessionIdRef.current === sessionId) {
        setState(agentState);
      }
    });

    return () => sub.unsubscribe();
  }, [client, sessionId]);

  // Fetch available models via REST (still needed, not in SSE)
  const loadModels = useCallback(
    async (attempt = 0) => {
      if (!sessionId) return;
      setIsLoading(true);
      setError(null);

      try {
        const modelsResult = await client.api.getAvailableModels(sessionId);
        if (sessionIdRef.current !== sessionId) return;
        setModels((modelsResult.models ?? []) as unknown as ModelInfo[]);
        attemptRef.current = 0;
        setIsLoading(false);
      } catch (err) {
        if (sessionIdRef.current !== sessionId) return;

        const nextAttempt = attempt + 1;
        if (nextAttempt < MAX_RETRIES) {
          attemptRef.current = nextAttempt;
          retryTimerRef.current = setTimeout(() => {
            if (sessionIdRef.current === sessionId) {
              loadModels(nextAttempt);
            }
          }, RETRY_DELAY_MS);
        } else {
          const message =
            err instanceof Error ? err.message : "Failed to load available models";
          setError(message);
          setIsLoading(false);
          attemptRef.current = 0;
        }
      }
    },
    [client, sessionId],
  );

  useEffect(() => {
    clearRetryTimer();
    attemptRef.current = 0;
    setError(null);
    loadModels();

    return () => {
      clearRetryTimer();
    };
  }, [loadModels, clearRetryTimer]);

  const retry = useCallback(() => {
    clearRetryTimer();
    attemptRef.current = 0;
    setError(null);
    loadModels(0);
  }, [loadModels, clearRetryTimer]);

  const setModel = useCallback(
    async (params: { provider: string; modelId: string }) => {
      if (!sessionId) return;

      const selectedModel = models?.find(
        (model) =>
          model.id === params.modelId &&
          (model.provider ?? "unknown") === params.provider,
      );

      setState((prev) =>
        prev
          ? {
              ...prev,
              model: {
                ...prev.model,
                id: params.modelId,
                provider: params.provider,
                name: selectedModel?.name ?? selectedModel?.id ?? params.modelId,
              },
            }
          : prev,
      );

      try {
        await client.setModel(sessionId, params);
      } catch {
        loadModels();
      }
    },
    [client, sessionId, loadModels, models],
  );

  const setThinkingLevel = useCallback(
    async (level: string) => {
      if (!sessionId) return;

      setState((prev) =>
        prev
          ? {
              ...prev,
              thinkingLevel: level,
            }
          : prev,
      );

      try {
        await client.setThinkingLevel(sessionId, level);
      } catch {
        loadModels();
      }
    },
    [client, sessionId, loadModels],
  );

  const setMode = useCallback(
    async (mode: AgentMode) => {
      if (!sessionId) return;

      setState((prev) =>
        prev
          ? {
              ...prev,
              mode,
            }
          : prev,
      );

      try {
        await client.prompt(sessionId, mode === "plan" ? "/plan" : "/chat");
      } catch {
        loadModels();
      }
    },
    [client, sessionId, loadModels],
  );

  return {
    state,
    models,
    isLoading,
    error,
    setModel,
    setThinkingLevel,
    setMode,
    reload: loadModels,
    retry,
  };
}
