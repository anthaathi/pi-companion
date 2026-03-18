import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  status as gitStatus,
  stage as gitStage,
  unstage as gitUnstage,
  discard as gitDiscard,
  commit as gitCommit,
  diff as gitDiff,
  diffFile as gitDiffFile,
  log as gitLog,
} from '@/features/api/generated/sdk.gen';

function extract<T>(raw: unknown): T | undefined {
  const envelope = raw as Record<string, unknown> | null | undefined;
  if (envelope && 'data' in envelope && envelope.data != null) {
    return envelope.data as T;
  }
  return envelope as T | undefined;
}

function statusKey(cwd: string) {
  return ['git-status', cwd] as const;
}

export function useGitStatus(cwd: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: statusKey(cwd ?? ''),
    queryFn: async () => {
      const result = await gitStatus({ query: { cwd: cwd! } });
      if (result.error) throw new Error('Failed to fetch git status');
      return extract<{
        branch: string;
        is_clean: boolean;
        staged: Array<{ path: string; status: string }>;
        unstaged: Array<{ path: string; status: string }>;
        untracked: Array<string>;
        ahead: number;
        behind: number;
      }>(result.data);
    },
    enabled: !!cwd,
    refetchInterval: 10_000,
  });

  const invalidate = useCallback(() => {
    if (cwd) queryClient.invalidateQueries({ queryKey: statusKey(cwd) });
  }, [cwd, queryClient]);

  const stageMutation = useMutation({
    mutationFn: async (paths: string[]) => {
      const result = await gitStage({ query: { cwd: cwd! }, body: { paths } });
      if (result.error) throw new Error('Failed to stage');
    },
    onSuccess: invalidate,
  });

  const unstageMutation = useMutation({
    mutationFn: async (paths: string[]) => {
      const result = await gitUnstage({ query: { cwd: cwd! }, body: { paths } });
      if (result.error) throw new Error('Failed to unstage');
    },
    onSuccess: invalidate,
  });

  const discardMutation = useMutation({
    mutationFn: async (paths: string[]) => {
      const result = await gitDiscard({ query: { cwd: cwd! }, body: { paths } });
      if (result.error) throw new Error('Failed to discard');
    },
    onSuccess: invalidate,
  });

  const commitMutation = useMutation({
    mutationFn: async (message: string) => {
      const result = await gitCommit({ query: { cwd: cwd! }, body: { message } });
      if (result.error) throw new Error('Failed to commit');
    },
    onSuccess: invalidate,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    stage: stageMutation.mutateAsync,
    unstage: unstageMutation.mutateAsync,
    discard: discardMutation.mutateAsync,
    commit: commitMutation.mutateAsync,
    isCommitting: commitMutation.isPending,
    refresh: invalidate,
  };
}

export function useGitDiff(cwd: string | null, staged: boolean) {
  return useQuery({
    queryKey: ['git-diff', cwd ?? '', staged],
    queryFn: async () => {
      const result = await gitDiff({ query: { cwd: cwd!, staged } });
      if (result.error) throw new Error('Failed to fetch diff');
      return extract<{ diff: string; stats: string }>(result.data);
    },
    enabled: !!cwd,
  });
}

export function useFileDiff(
  cwd: string | null,
  filePath: string | null,
  staged: boolean,
) {
  return useQuery({
    queryKey: ['git-diff-file', cwd ?? '', filePath ?? '', staged],
    queryFn: async () => {
      const result = await gitDiffFile({
        query: { cwd: cwd!, path: filePath!, staged },
      });
      if (result.error) throw new Error('Failed to fetch file diff');
      return extract<{ path: string; diff: string }>(result.data);
    },
    enabled: !!cwd && !!filePath,
    staleTime: 0,
    retry: 1,
  });
}

export function useGitLog(cwd: string | null, count = 30) {
  return useQuery({
    queryKey: ['git-log', cwd ?? '', count],
    queryFn: async () => {
      const result = await gitLog({ query: { cwd: cwd!, count } });
      if (result.error) throw new Error('Failed to fetch log');
      return (
        extract<
          Array<{
            hash: string;
            short_hash: string;
            author: string;
            date: string;
            message: string;
          }>
        >(result.data) ?? []
      );
    },
    enabled: !!cwd,
  });
}
