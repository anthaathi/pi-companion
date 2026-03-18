import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, usePathname } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, WorkspaceColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useWorkspaceStore } from '@/features/workspace/store';
import { WorkspaceAvatar } from '../workspace-avatar';
import { AddWorkspaceButton } from '../add-workspace-button';

export function BottomNavigation() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const selectWorkspace = useWorkspaceStore((s) => s.selectWorkspace);
  const addWorkspace = useWorkspaceStore((s) => s.addWorkspace);

  const isSettingsActive = pathname.startsWith('/settings');
  const isProfileActive = pathname.startsWith('/profile');

  const handleWorkspacePress = (id: string) => {
    selectWorkspace(id);
    router.replace(`/workspace/${id}`);
  };

  const handleAddWorkspace = () => {
    addWorkspace({
      title: `Project ${workspaces.length + 1}`,
      path: '~/work/project-' + (workspaces.length + 1),
      color: WorkspaceColors[workspaces.length % WorkspaceColors.length],
    });
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.background,
          paddingBottom: insets.bottom,
          borderTopColor: colors.border,
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.workspaceScroll}
      >
        {workspaces.map((ws) => (
          <WorkspaceAvatar
            key={ws.id}
            title={ws.title}
            color={ws.color}
            isActive={ws.id === selectedWorkspaceId}
            hasNotification={ws.hasNotifications}
            onPress={() => handleWorkspacePress(ws.id)}
            layout="horizontal"
          />
        ))}
        <AddWorkspaceButton onPress={handleAddWorkspace} layout="horizontal" />
      </ScrollView>

      <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />

      <View style={styles.fixedItems}>
        <BottomBarIcon
          icon="settings"
          isActive={isSettingsActive}
          onPress={() => router.push('/settings')}
        />
        <BottomBarIcon
          icon="person-outline"
          isActive={isProfileActive}
          onPress={() => router.push('/profile')}
        />
      </View>
    </View>
  );
}

function BottomBarIcon({
  icon,
  isActive,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  isActive: boolean;
  onPress: () => void;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        isActive && { backgroundColor: colors.surfaceRaised },
        pressed && { opacity: 0.7 },
      ]}
    >
      <MaterialIcons
        name={icon}
        size={22}
        color={isActive ? colors.text : colors.icon}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 6,
  },
  workspaceScroll: {
    flex: 1,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    paddingHorizontal: 8,
  },
  dividerVertical: {
    width: 1,
    height: 28,
    marginHorizontal: 4,
  },
  fixedItems: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingRight: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
