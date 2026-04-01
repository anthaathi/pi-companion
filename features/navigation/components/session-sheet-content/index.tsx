import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SquarePen, RefreshCw } from 'lucide-react-native';

import { Fonts } from '@/constants/theme';
import { SessionActivityIndicator } from '@/features/workspace/components/session-activity-indicator';
import { AnimatedListItem } from '@/components/ui/animated-list-item';

export interface SessionItem {
  id: string;
  display_name?: string | null;
}

interface SessionSheetContentProps {
  title: string;
  subtitle?: string | null;
  sessions: SessionItem[];
  selectedSessionId: string | null;
  isLoading: boolean;
  isRefetching: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  createPending?: boolean;
  newButtonLabel?: string;
  emptyLabel?: string;
  isDark: boolean;
  onNew: () => void;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  footer?: ReactNode;
}

export function SessionSheetContent({
  title,
  subtitle,
  sessions,
  selectedSessionId,
  isLoading,
  isRefetching,
  hasNextPage,
  isFetchingNextPage,
  createPending = false,
  newButtonLabel = 'New session',
  emptyLabel = 'No sessions yet',
  isDark,
  onNew,
  onSelect,
  onRefresh,
  onLoadMore,
  footer,
}: SessionSheetContentProps) {
  const textPrimary = isDark ? '#fefdfd' : '#1a1a1a';
  const textMuted = isDark ? '#cdc8c5' : '#999999';
  const textSecondary = isDark ? '#f1ece8' : '#666666';
  const btnBg = isDark ? '#252525' : '#F0F0F0';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: textPrimary }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: textSecondary }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={onRefresh}
            disabled={isRefetching}
            style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}
          >
            {isRefetching ? (
              <ActivityIndicator size={13} color={textMuted} />
            ) : (
              <RefreshCw size={13} color={textMuted} strokeWidth={1.8} />
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onNew}
          disabled={createPending}
          style={({ pressed }) => [
            styles.newButton,
            { backgroundColor: btnBg },
            pressed && { opacity: 0.8 },
          ]}
        >
          {createPending ? (
            <ActivityIndicator size={14} color={textPrimary} />
          ) : (
            <SquarePen size={14} color={textPrimary} strokeWidth={1.8} />
          )}
          <Text style={[styles.newButtonText, { color: textPrimary }]}>{newButtonLabel}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : sessions.length === 0 ? (
          <Text style={[styles.emptyText, { color: textMuted }]}>{emptyLabel}</Text>
        ) : (
          sessions.map((session) => (
            <AnimatedListItem key={session.id}>
              <Pressable
                onPress={() => onSelect(session.id)}
                style={({ pressed }) => [
                  styles.sessionItem,
                  session.id === selectedSessionId && {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <SessionActivityIndicator sessionId={session.id} color={textMuted} />
                <Text style={[styles.sessionTitle, { color: textPrimary }]} numberOfLines={1}>
                  {session.display_name ?? session.id}
                </Text>
              </Pressable>
            </AnimatedListItem>
          ))
        )}
        {hasNextPage && (
          <Pressable
            onPress={onLoadMore}
            disabled={isFetchingNextPage}
            style={({ pressed }) => [
              styles.loadMoreButton,
              { backgroundColor: btnBg },
              pressed && { opacity: 0.8 },
            ]}
          >
            {isFetchingNextPage ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text style={[styles.loadMoreText, { color: textMuted }]}>Load more</Text>
            )}
          </Pressable>
        )}
      </ScrollView>

      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  iconButton: {
    padding: 6,
  },
  title: {
    fontSize: 15,
    fontFamily: Fonts.sansSemiBold,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.sans,
    marginTop: 2,
  },
  actions: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: 8,
  },
  newButtonText: {
    fontSize: 14,
    fontFamily: Fonts.sansMedium,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    gap: 2,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
  },
  sessionTitle: {
    fontSize: 14,
    fontFamily: Fonts.sans,
    flex: 1,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: Fonts.sans,
    textAlign: 'center',
    marginTop: 24,
  },
  loadMoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: 8,
    marginTop: 8,
  },
  loadMoreText: {
    fontSize: 13,
    fontFamily: Fonts.sansMedium,
  },
});
