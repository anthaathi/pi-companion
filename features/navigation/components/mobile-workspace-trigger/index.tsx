import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useWorkspaceStore } from '@/features/workspace/store';

interface MobileWorkspaceTriggerProps {
  onPress: () => void;
}

export function MobileWorkspaceTrigger({ onPress }: MobileWorkspaceTriggerProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const workspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.selectedWorkspaceId)
  );
  const hasAnyNotifications = useWorkspaceStore((s) =>
    s.workspaces.some((w) => w.hasNotifications)
  );

  if (!workspace) return null;

  return (
    <View style={[styles.wrapper, { top: insets.top + 8 }]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.border,
          },
          pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: workspace.color }]}>
          <Text style={styles.initial}>
            {workspace.title.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text
          style={[styles.name, { color: colors.text }]}
          numberOfLines={1}
        >
          {workspace.title}
        </Text>
        {hasAnyNotifications && (
          <View style={[styles.notifDot, { backgroundColor: colors.notificationDot }]} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    zIndex: 50,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 3,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  name: {
    fontSize: 13,
    fontWeight: '500',
    maxWidth: 120,
  },
  notifDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
