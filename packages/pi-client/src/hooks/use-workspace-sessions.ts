import { useEffect, useCallback, useRef, useMemo } from "react";
import { BehaviorSubject } from "rxjs";
import { usePiClient } from "./context";
import { useObservable } from "./use-observable";
import type { SessionListItem } from "../types";
import type { StreamEventEnvelope } from "../types/stream-events";

const PAGE_SIZE = 20;
const REFRESH_DEBOUNCE_MS = 350;

function shouldRefreshWorkspaceSessions(event: StreamEventEnvelope, workspaceId: string): boolean {
  if (event.workspace_id !== workspaceId || !event.session_id) return false;
  if (event.type === "client_command") {
    const commandType = (event.data as { type?: string } | undefined)?.type;
    return commandType === "prompt" || commandType === "steer" || commandType === "follow_up";
  }
  return (
    event.type === "message_start" ||
    event.type === "message_end" ||
    event.type === "turn_end" ||
    event.type === "agent_end" ||
    event.type === "session_process_exited" ||
    event.type === "session_idle_timeout"
  );
}

export interface WorkspaceSessionsState {
  sessions: SessionListItem[];
  total: number;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  isRefetching: boolean;
  error: string | null;
}

interface InternalState extends WorkspaceSessionsState {
  page: number;
}

const INITIAL_STATE: InternalState = {
  sessions: [],
  total: 0,
  isLoading: true,
  isFetchingNextPage: false,
  hasNextPage: false,
  isRefetching: false,
  error: null,
  page: 0,
};

export interface WorkspaceSessionsHandle extends WorkspaceSessionsState {
  fetchNextPage: () => void;
  refetch: () => void;
  deleteSession: (sessionId: string) => Promise<void>;
}

export function useWorkspaceSessions(
  workspaceId: string | null,
): WorkspaceSessionsHandle {
  const client = usePiClient();
  const { api } = client;
  const state$ = useRef(new BehaviorSubject<InternalState>(INITIAL_STATE));
  const workspaceIdRef = useRef(workspaceId);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  workspaceIdRef.current = workspaceId;

  const emit = useCallback(
    (patch: Partial<InternalState>) =>
      state$.current.next({ ...state$.current.value, ...patch }),
    [],
  );

  const loadPage = useCallback(
    async (page: number, append: boolean) => {
      const wid = workspaceIdRef.current;
      if (!wid) return;
      try {
        const data = await api.listWorkspaceSessions(wid, {
          page,
          limit: PAGE_SIZE,
        });
        const items = data.items ?? [];
        const prev = append ? state$.current.value.sessions : [];
        emit({
          sessions: [...prev, ...items],
          total: data.total,
          page: data.page,
          hasNextPage: data.has_more,
          isLoading: false,
          isFetchingNextPage: false,
          isRefetching: false,
          error: null,
        });
      } catch (e: any) {
        emit({
          isLoading: false,
          isFetchingNextPage: false,
          isRefetching: false,
          error: e?.message ?? "Failed to fetch sessions",
        });
      }
    },
    [api, emit],
  );

  useEffect(() => {
    state$.current.next(INITIAL_STATE);
    if (!workspaceId) return;
    loadPage(1, false);
  }, [workspaceId, loadPage]);

  const fetchNextPage = useCallback(() => {
    const s = state$.current.value;
    if (!s.hasNextPage || s.isFetchingNextPage) return;
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    emit({ isFetchingNextPage: true });
    loadPage(s.page + 1, true);
  }, [loadPage, emit]);

  const refetch = useCallback(() => {
    emit({ isRefetching: true });
    loadPage(1, false);
  }, [loadPage, emit]);

  const scheduleRefetch = useCallback(() => {
    const current = state$.current.value;
    if (current.isLoading || current.isFetchingNextPage || current.page > 1) return;
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      const latest = state$.current.value;
      if (latest.isLoading || latest.isFetchingNextPage || latest.page > 1) {
        refreshTimerRef.current = null;
        return;
      }
      refreshTimerRef.current = null;
      emit({ isRefetching: true });
      loadPage(1, false);
    }, REFRESH_DEBOUNCE_MS);
  }, [emit, loadPage]);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      const wid = workspaceIdRef.current;
      if (!wid) return;
      await api.deleteWorkspaceSession(wid, sessionId);
      refetch();
    },
    [api, refetch],
  );

  useEffect(() => {
    if (!workspaceId) return;
    const subscription = client.events$.subscribe((event) => {
      if (!shouldRefreshWorkspaceSessions(event, workspaceId)) return;
      scheduleRefetch();
    });
    return () => subscription.unsubscribe();
  }, [client, workspaceId, scheduleRefetch]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);

  const snapshot = useObservable(state$.current, INITIAL_STATE);
  const publicState = useMemo<WorkspaceSessionsState>(
    () => ({
      sessions: snapshot.sessions,
      total: snapshot.total,
      isLoading: snapshot.isLoading,
      isFetchingNextPage: snapshot.isFetchingNextPage,
      hasNextPage: snapshot.hasNextPage,
      isRefetching: snapshot.isRefetching,
      error: snapshot.error,
    }),
    [snapshot],
  );

  return { ...publicState, fetchNextPage, refetch, deleteSession };
}
