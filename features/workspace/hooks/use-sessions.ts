import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { sessionsList, sessionsDelete } from '@/features/api/generated/sdk.gen';
import type { SessionListItem } from '@/features/api/generated/types.gen';

const PAGE_SIZE = 20;

function sessionsQueryKey(workspaceId: string) {
  return ['sessions', workspaceId] as const;
}

function extractPaginated(raw: unknown): {
  items: SessionListItem[];
  page: number;
  has_more: boolean;
  total: number;
} {
  const envelope = raw as Record<string, unknown> | null | undefined;
  const inner = (envelope && 'data' in envelope ? envelope.data : envelope) as
    | Record<string, unknown>
    | null
    | undefined;
  return {
    items: (Array.isArray(inner?.items) ? inner.items : []) as SessionListItem[],
    page: typeof inner?.page === 'number' ? inner.page : 1,
    has_more: inner?.has_more === true,
    total: typeof inner?.total === 'number' ? inner.total : 0,
  };
}

export function useSessions(workspaceId: string | null) {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: sessionsQueryKey(workspaceId ?? ''),
    queryFn: async ({ pageParam }) => {
      const result = await sessionsList({
        path: { id: workspaceId! },
        query: { page: pageParam, limit: PAGE_SIZE },
      });
      if (result.error) throw new Error('Failed to fetch sessions');
      const parsed = extractPaginated(result.data);
      return {
        items: parsed.items,
        page: parsed.page,
        hasMore: parsed.has_more,
        total: parsed.total,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: !!workspaceId,
  });

  const sessions = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages.at(-1)?.total ?? 0;

  const deleteSession = useCallback(
    async (sessionId: string) => {
      if (!workspaceId) return;
      const result = await sessionsDelete({
        path: { id: workspaceId, session_id: sessionId },
      });
      if (!result.error) {
        queryClient.invalidateQueries({
          queryKey: sessionsQueryKey(workspaceId),
        });
      }
    },
    [workspaceId, queryClient],
  );

  return {
    sessions,
    total,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
    deleteSession,
    isRefetching: query.isRefetching && !query.isFetchingNextPage,
  };
}
