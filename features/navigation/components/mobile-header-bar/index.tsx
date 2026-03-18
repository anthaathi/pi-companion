import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GitBranch } from 'lucide-react-native';

import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useWorkspaceStore } from '@/features/workspace/store';

interface MobileHeaderBarProps {
  onWorkspacePress: () => void;
  onGitPress: () => void;
}

export function MobileHeaderBar({ onWorkspacePress, onGitPress }: MobileHeaderBarProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

  const workspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.selectedWorkspaceId)
  );

  const textPrimary = isDark ? '#fefdfd' : colors.text;
  const textMuted = isDark ? '#cdc8c5' : colors.textTertiary;
  const borderColor = isDark ? '#323131' : 'rgba(0,0,0,0.08)';

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: 4,
          backgroundColor: colors.background,
          borderBottomColor: borderColor,
        },
      ]}
    >
      <Pressable
        onPress={onWorkspacePress}
        style={({ pressed }) => [
          styles.workspaceButton,
          pressed && { opacity: 0.7 },
        ]}
      >
        {workspace && (
          <View style={[styles.avatar, { backgroundColor: workspace.color }]}>
            <Text style={styles.avatarInitial}>
              {workspace.title.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={[styles.workspaceName, { color: textPrimary }]} numberOfLines={1}>
          {workspace?.title ?? 'Workspace'}
        </Text>
      </Pressable>

      <View style={styles.headerActions}>
        <Pressable
          onPress={onGitPress}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && { opacity: 0.7 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Git changes"
        >
          <GitBranch size={18} color={textMuted} strokeWidth={1.8} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 0.633,
  },
  workspaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: Fonts.sansSemiBold,
  },
  workspaceName: {
    fontSize: 15,
    fontFamily: Fonts.sansMedium,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
