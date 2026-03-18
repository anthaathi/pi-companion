import { useCallback, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";

import { useWorkspaceStore } from "@/features/workspace/store";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { WorkspaceAvatar } from "../workspace-avatar";
import { WorkspaceContextMenu } from "../workspace-context-menu";
import { RailItem } from "../rail-item";
import { AddWorkspaceButton } from "../add-workspace-button";
import { NewWorkspaceDialog } from "@/features/workspace/components/new-workspace-dialog";
import { EditWorkspaceDialog } from "@/features/workspace/components/edit-workspace-dialog";
import type { Workspace } from "@/features/workspace/types";

const RAIL_WIDTH = 64;

export function NavigationRail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [editWorkspace, setEditWorkspace] = useState<Workspace | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    workspace: Workspace | null;
  }>({ visible: false, x: 0, y: 0, workspace: null });

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const selectWorkspace = useWorkspaceStore((s) => s.selectWorkspace);
  const removeWorkspace = useWorkspaceStore((s) => s.removeWorkspace);

  const isServersActive = pathname.startsWith("/servers");
  const isSettingsActive = pathname.startsWith("/settings");
  const isProfileActive = pathname.startsWith("/profile");

  const handleWorkspacePress = (id: string) => {
    selectWorkspace(id);
    router.replace(`/workspace/${id}`);
  };

  const handleContextMenu = useCallback(
    (ws: Workspace, e: any) => {
      if (Platform.OS === "web") {
        e.preventDefault?.();
        const nativeEvent = e.nativeEvent ?? e;
        setContextMenu({
          visible: true,
          x: nativeEvent.pageX ?? nativeEvent.clientX ?? 0,
          y: nativeEvent.pageY ?? nativeEvent.clientY ?? 0,
          workspace: ws,
        });
      }
    },
    [],
  );

  const handleDelete = useCallback(
    (ws: Workspace) => {
      if (Platform.OS === "web") {
        if (window.confirm(`Delete workspace "${ws.title}"?`)) {
          removeWorkspace(ws.id);
        }
      } else {
        Alert.alert("Delete Workspace", `Delete "${ws.title}"?`, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => removeWorkspace(ws.id),
          },
        ]);
      }
    },
    [removeWorkspace],
  );

  return (
    <View
      style={[
        styles.rail,
        {
          backgroundColor: colors.background,
          paddingBottom: insets.bottom + 8,
        },
      ]}
    >
      <ScrollView
        style={styles.workspaceList}
        contentContainerStyle={styles.workspaceListContent}
        showsVerticalScrollIndicator={false}
      >
        {workspaces.map((ws) => (
          <View
            key={ws.id}
            {...({ onContextMenu: (e: any) => handleContextMenu(ws, e) } as any)}
          >
            <WorkspaceAvatar
              title={ws.title}
              color={ws.color}
              isActive={ws.id === selectedWorkspaceId}
              hasNotification={ws.hasNotifications}
              onPress={() => handleWorkspacePress(ws.id)}
            />
          </View>
        ))}

        <AddWorkspaceButton onPress={() => setShowNewDialog(true)} />
      </ScrollView>

      <View style={styles.spacer} />

      <View style={styles.fixedItems}>
        <RailItem
          icon="server"
          label="Servers"
          isActive={isServersActive}
          onPress={() => router.push("/servers")}
        />
        <RailItem
          icon="settings"
          label="Settings"
          isActive={isSettingsActive}
          onPress={() => router.push("/settings")}
        />
        <RailItem
          icon="help-outline"
          label="Help"
          isActive={isProfileActive}
          onPress={() => router.push("/profile")}
        />
      </View>
      <NewWorkspaceDialog
        visible={showNewDialog}
        onClose={() => setShowNewDialog(false)}
      />
      <EditWorkspaceDialog
        visible={!!editWorkspace}
        workspace={editWorkspace}
        onClose={() => setEditWorkspace(null)}
      />
      <WorkspaceContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        onEdit={() => setEditWorkspace(contextMenu.workspace)}
        onDelete={() => {
          if (contextMenu.workspace) handleDelete(contextMenu.workspace);
        }}
        onClose={() =>
          setContextMenu((prev) => ({ ...prev, visible: false }))
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: RAIL_WIDTH,
    alignSelf: "stretch",
    alignItems: "center",
    height: "100%",
  },
  workspaceList: {
    flexGrow: 0,
    flexShrink: 1,
  },
  workspaceListContent: {
    alignItems: "center",
    gap: 0,
  },
  spacer: {
    flexGrow: 1,
  },
  fixedItems: {
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
  },
});
