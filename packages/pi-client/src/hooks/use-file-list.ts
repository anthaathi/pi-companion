import { useEffect, useCallback, useRef } from "react";
import { BehaviorSubject } from "rxjs";
import { usePiClient } from "./context";
import { useObservable } from "./use-observable";
import type { FsEntry, FsReadResponse } from "../types";

export interface FileListState {
  entries: FsEntry[];
  isLoading: boolean;
  error: string | null;
}

const INITIAL_LIST: FileListState = { entries: [], isLoading: true, error: null };

export function useFileList(dirPath: string | null, refreshKey = 0): FileListState {
  const { api } = usePiClient();
  const state$ = useRef(new BehaviorSubject<FileListState>(INITIAL_LIST));

  useEffect(() => {
    state$.current.next(INITIAL_LIST);
    if (!dirPath) return;

    let cancelled = false;
    api
      .fsList(dirPath)
      .then((data) => {
        if (!cancelled)
          state$.current.next({
            entries: data.entries ?? [],
            isLoading: false,
            error: null,
          });
      })
      .catch((e: any) => {
        if (!cancelled)
          state$.current.next({
            entries: [],
            isLoading: false,
            error: e?.message ?? "Failed to list directory",
          });
      });

    return () => {
      cancelled = true;
    };
  }, [dirPath, refreshKey, api]);

  return useObservable(state$.current, INITIAL_LIST);
}

export interface FileReadState {
  data: FsReadResponse | null;
  isLoading: boolean;
  error: string | null;
}

const INITIAL_READ: FileReadState = { data: null, isLoading: true, error: null };

export function useFileRead(filePath: string | null): FileReadState {
  const { api } = usePiClient();
  const state$ = useRef(new BehaviorSubject<FileReadState>(INITIAL_READ));

  useEffect(() => {
    state$.current.next(INITIAL_READ);
    if (!filePath) return;

    let cancelled = false;
    api
      .fsRead(filePath)
      .then((data) => {
        if (!cancelled) state$.current.next({ data, isLoading: false, error: null });
      })
      .catch((e: any) => {
        if (!cancelled)
          state$.current.next({
            data: null,
            isLoading: false,
            error: e?.message ?? "Failed to read file",
          });
      });

    return () => {
      cancelled = true;
    };
  }, [filePath, api]);

  return useObservable(state$.current, INITIAL_READ);
}

export interface PathCompletionHandle {
  complete: (input: string) => Promise<void>;
  completions: Array<{ path: string; is_dir: boolean; display: string }>;
  isLoading: boolean;
}

export function usePathCompletion(): PathCompletionHandle {
  const { api } = usePiClient();
  const state$ = useRef(
    new BehaviorSubject<{ completions: PathCompletionHandle["completions"]; isLoading: boolean }>({
      completions: [],
      isLoading: false,
    }),
  );

  const complete = useCallback(
    async (input: string) => {
      state$.current.next({ ...state$.current.value, isLoading: true });
      try {
        const results = await api.fsComplete(input);
        state$.current.next({
          completions: results.map((r) => ({
            path: r.path,
            is_dir: r.is_dir,
            display: r.path.split("/").pop() ?? r.path,
          })),
          isLoading: false,
        });
      } catch {
        state$.current.next({ completions: [], isLoading: false });
      }
    },
    [api],
  );

  const snapshot = useObservable(state$.current, { completions: [], isLoading: false });

  return { ...snapshot, complete };
}
