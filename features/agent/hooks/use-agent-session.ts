import { useEffect, useRef, useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createSession,
  touchSession,
  prompt as apiPrompt,
  abort as apiAbort,
  getState as apiGetState,
  getMessages as apiGetMessages,
} from "@/features/api/generated/sdk.gen";
import { unwrapApiData } from "@/features/api/unwrap";
import { useAgentStore } from "../store";
import type { AgentSessionInfo } from "@/features/api/generated/types.gen";

export function useAgentSession(
  sessionId: string | null,
  workspaceId: string | null,
  sessionFile?: string | null,
) {
  const setHistoryMessages = useAgentStore((s) => s.setHistoryMessages);
  const touchedRef = useRef<string | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);

  useEffect(() => {
    touchedRef.current = null;
    setIsSessionReady(false);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !workspaceId || !sessionFile) return;
    if (touchedRef.current === sessionId) return;
    touchedRef.current = sessionId;

    (async () => {
      const msgs = await apiGetMessages({
        body: { session_id: sessionId },
      });
      if (!msgs.error) {
        const data = unwrapApiData(msgs.data) as Record<string, any> | undefined;
        if (data?.messages) {
          setHistoryMessages(sessionId, data.messages);
        }
      }

      const result = await touchSession({
        path: { session_id: sessionId },
        body: {
          session_file: sessionFile,
          workspace_id: workspaceId,
        },
      });
      if (!result.error) {
        setIsSessionReady(true);
      }
    })();
  }, [sessionId, workspaceId, sessionFile, setHistoryMessages]);

  return { isSessionReady };
}

export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      workspaceId: string;
      sessionPath?: string;
    }) => {
      const result = await createSession({
        body: {
          workspace_id: params.workspaceId,
          session_path: params.sessionPath,
        },
      });
      if (result.error) throw new Error("Failed to create session");
      return unwrapApiData(result.data) as AgentSessionInfo;
    },
    onSuccess: (_data, variables) => {
      queryClient.refetchQueries({
        queryKey: ["sessions", variables.workspaceId],
      });
    },
  });
}

export function useSendPrompt() {
  return useMutation({
    mutationFn: async (params: {
      sessionId: string;
      message: string;
      streamingBehavior?: string;
    }) => {
      const result = await apiPrompt({
        body: {
          session_id: params.sessionId,
          message: params.message,
          streaming_behavior: params.streamingBehavior,
        },
      });
      if (result.error) throw new Error("Failed to send prompt");
      return unwrapApiData(result.data);
    },
  });
}

export function useAbortAgent() {
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const result = await apiAbort({
        body: { session_id: sessionId },
      });
      if (result.error) throw new Error("Failed to abort");
      return unwrapApiData(result.data);
    },
  });
}
