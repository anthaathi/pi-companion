import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useWorkspaceStore } from "@/features/workspace/store";
import { FileTree } from "@/features/workspace/components/file-tree";

/**
 * Standalone files panel — used in the mobile Files sheet.
 * Wraps the FileTree with workspace path and enables actions.
 */
export function FilesPanel() {
  const colorScheme = useColorScheme() ?? "light";
  const isDark = colorScheme === "dark";
  const colors = Colors[colorScheme];

  const textMuted = isDark ? "#cdc8c5" : colors.textTertiary;
  const surfaceBg = isDark ? "#1e1e1e" : "#FFFFFF";

  const workspace = useWorkspaceStore((s) => {
    const id = s.selectedWorkspaceId;
    return s.workspaces.find((w) => w.id === id);
  });

  const cwd = workspace?.path ?? null;

  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  const handleToggleDir = useCallback((dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
  }, []);

  if (!cwd) {
    return (
      <View style={[styles.container, { backgroundColor: surfaceBg }]}>
        <Text style={[styles.emptyText, { color: textMuted }]}>
          No workspace selected
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: surfaceBg }]}>
      <View style={[styles.header, { borderBottomColor: isDark ? "#323131" : "rgba(0,0,0,0.08)" }]}>
        <Text style={[styles.title, { color: isDark ? "#fefdfd" : colors.text }]} numberOfLines={1}>
          Files
        </Text>
        <Text style={[styles.subtitle, { color: textMuted }]} numberOfLines={1}>
          {workspace?.title ?? cwd}
        </Text>
      </View>
      <FileTree
        rootPath={cwd}
        viewingFile={viewingFile}
        onViewFile={setViewingFile}
        expandedDirs={expandedDirs}
        onToggleDir={handleToggleDir}
        showActions
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 36,
    borderBottomWidth: 0.633,
  },
  title: {
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: Fonts.sans,
    flex: 1,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: Fonts.sans,
    textAlign: "center",
    marginTop: 32,
  },
});
