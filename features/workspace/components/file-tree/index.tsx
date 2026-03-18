import { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  ArrowLeft,
} from "lucide-react-native";

import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  useFileList,
  useFileRead,
  type FsEntry,
} from "@/features/workspace/hooks/use-file-list";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileTreeProps {
  rootPath: string;
  viewingFile: string | null;
  onViewFile: (path: string | null) => void;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
}

export function FileTree({
  rootPath,
  viewingFile,
  onViewFile,
  expandedDirs,
  onToggleDir,
}: FileTreeProps) {
  const colorScheme = useColorScheme() ?? "light";
  const isDark = colorScheme === "dark";
  const textMuted = isDark ? "#cdc8c5" : Colors[colorScheme].textTertiary;

  if (viewingFile) {
    return (
      <FileViewer
        filePath={viewingFile}
        onBack={() => onViewFile(null)}
      />
    );
  }

  return (
    <FileTreeRoot
      rootPath={rootPath}
      textMuted={textMuted}
      onFilePress={(p) => onViewFile(p)}
      expandedDirs={expandedDirs}
      onToggleDir={onToggleDir}
    />
  );
}

function FileTreeRoot({
  rootPath,
  textMuted,
  onFilePress,
  expandedDirs,
  onToggleDir,
}: {
  rootPath: string;
  textMuted: string;
  onFilePress: (path: string) => void;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
}) {
  const { data: entries, isLoading, isError, error } = useFileList(rootPath);

  if (isLoading) {
    return <ActivityIndicator style={{ marginTop: 32 }} />;
  }

  if (isError) {
    return (
      <Text style={[styles.emptyText, { color: textMuted }]}>
        Failed to load: {(error as Error)?.message ?? "Unknown error"}
      </Text>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <Text style={[styles.emptyText, { color: textMuted }]}>
        Empty directory
      </Text>
    );
  }

  const sorted = [...entries].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {sorted.map((entry) => (
        <FileTreeNode
          key={entry.path}
          entry={entry}
          depth={0}
          onFilePress={onFilePress}
          expandedDirs={expandedDirs}
          onToggleDir={onToggleDir}
        />
      ))}
    </ScrollView>
  );
}

function FileTreeNode({
  entry,
  depth,
  onFilePress,
  expandedDirs,
  onToggleDir,
}: {
  entry: FsEntry;
  depth: number;
  onFilePress: (path: string) => void;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
}) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";

  const textPrimary = isDark ? "#fefdfd" : colors.text;
  const textMuted = isDark ? "#cdc8c5" : colors.textTertiary;
  const hoverBg = isDark ? "#252525" : "#E8E8E8";
  const iconColor = isDark ? "#8B8685" : "#888";
  const dirIconColor = isDark ? "#C4A000" : "#B5920B";

  const expanded = entry.is_dir && expandedDirs.has(entry.path);

  const handlePress = useCallback(() => {
    if (entry.is_dir) {
      onToggleDir(entry.path);
    } else {
      onFilePress(entry.path);
    }
  }, [entry, onFilePress, onToggleDir]);

  return (
    <View>
      <Pressable
        onPress={handlePress}
        {...{ title: entry.path }}
        style={({ pressed, hovered }: any) => [
          styles.row,
          { paddingLeft: 12 + depth * 16 },
          (pressed || hovered) && { backgroundColor: hoverBg },
        ]}
      >
        {entry.is_dir ? (
          <>
            {expanded ? (
              <ChevronDown size={14} color={textMuted} strokeWidth={2} />
            ) : (
              <ChevronRight size={14} color={textMuted} strokeWidth={2} />
            )}
            <Folder size={14} color={dirIconColor} strokeWidth={1.8} />
          </>
        ) : (
          <>
            <View style={styles.chevronSpacer} />
            <FileText size={14} color={iconColor} strokeWidth={1.8} />
          </>
        )}
        <Text
          style={[
            styles.name,
            { color: textPrimary },
            entry.is_dir && styles.dirName,
          ]}
          numberOfLines={1}
        >
          {entry.name}
        </Text>
        {!entry.is_dir && entry.size > 0 && (
          <Text style={[styles.size, { color: textMuted }]}>
            {formatSize(entry.size)}
          </Text>
        )}
      </Pressable>
      {expanded && (
        <ExpandedDir
          dirPath={entry.path}
          depth={depth + 1}
          onFilePress={onFilePress}
          expandedDirs={expandedDirs}
          onToggleDir={onToggleDir}
        />
      )}
    </View>
  );
}

function ExpandedDir({
  dirPath,
  depth,
  onFilePress,
  expandedDirs,
  onToggleDir,
}: {
  dirPath: string;
  depth: number;
  onFilePress: (path: string) => void;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
}) {
  const colorScheme = useColorScheme() ?? "light";
  const isDark = colorScheme === "dark";
  const textMuted = isDark ? "#cdc8c5" : Colors[colorScheme].textTertiary;

  const { data: entries, isLoading } = useFileList(dirPath);

  if (isLoading) {
    return (
      <View style={{ paddingLeft: 12 + depth * 16, paddingVertical: 4 }}>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <Text
        style={[
          styles.emptyDir,
          { color: textMuted, paddingLeft: 12 + depth * 16 },
        ]}
      >
        Empty
      </Text>
    );
  }

  const sorted = [...entries].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <View>
      {sorted.map((entry) => (
        <FileTreeNode
          key={entry.path}
          entry={entry}
          depth={depth}
          onFilePress={onFilePress}
          expandedDirs={expandedDirs}
          onToggleDir={onToggleDir}
        />
      ))}
    </View>
  );
}

function FileViewer({
  filePath,
  onBack,
}: {
  filePath: string;
  onBack: () => void;
}) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";

  const textPrimary = isDark ? "#fefdfd" : colors.text;
  const textMuted = isDark ? "#cdc8c5" : colors.textTertiary;
  const headerBg = isDark ? "#1a1a1a" : "#F0F0F0";
  const headerBorder = isDark ? "#323131" : "rgba(0,0,0,0.08)";
  const lineBg = isDark ? "#111" : "#F8F8F8";
  const lineNumColor = isDark ? "#555" : "#AAA";
  const hoverBg = isDark ? "#252525" : "#E8E8E8";

  const fileName = filePath.split("/").pop() ?? filePath;

  const { data: fileData, isLoading, isError } = useFileRead(filePath);

  return (
    <View style={styles.viewerContainer}>
      {/* Sticky header */}
      <View
        style={[
          styles.viewerHeader,
          { backgroundColor: headerBg, borderBottomColor: headerBorder },
        ]}
      >
        <Pressable
          onPress={onBack}
          accessibilityLabel="Back to file tree"
          {...{ title: "Back" }}
          style={({ pressed, hovered }: any) => [
            styles.backButton,
            (pressed || hovered) && { backgroundColor: hoverBg },
          ]}
        >
          <ArrowLeft size={14} color={textMuted} strokeWidth={2} />
        </Pressable>
        <FileText size={13} color={textMuted} strokeWidth={1.8} />
        <Text
          style={[styles.viewerFileName, { color: textPrimary }]}
          numberOfLines={1}
        >
          {fileName}
        </Text>
        {fileData && (
          <Text style={[styles.viewerMeta, { color: textMuted }]}>
            {formatSize(fileData.size)}
            {fileData.truncated ? " (truncated)" : ""}
          </Text>
        )}
      </View>

      {/* Scrollable content */}
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : isError ? (
        <Text style={[styles.emptyText, { color: textMuted }]}>
          Cannot read file
        </Text>
      ) : fileData ? (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator
        >
          {fileData.content.split("\n").map((line, i) => (
            <View
              key={i}
              style={[
                styles.viewerLine,
                i % 2 === 0 && { backgroundColor: lineBg },
              ]}
            >
              <Text style={[styles.viewerLineNum, { color: lineNumColor }]}>
                {i + 1}
              </Text>
              <Text
                style={[styles.viewerLineText, { color: textPrimary }]}
                numberOfLines={1}
              >
                {line || " "}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingRight: 12,
    minHeight: 28,
  },
  chevronSpacer: {
    width: 14,
  },
  name: {
    fontSize: 13,
    fontFamily: Fonts.sans,
    flex: 1,
  },
  dirName: {
    fontFamily: Fonts.sansMedium,
  },
  size: {
    fontSize: 11,
    fontFamily: Fonts.sans,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: Fonts.sans,
    textAlign: "center",
    marginTop: 32,
  },
  emptyDir: {
    fontSize: 12,
    fontFamily: Fonts.sans,
    paddingVertical: 4,
    fontStyle: "italic",
  },
  viewerContainer: {
    flex: 1,
  },
  viewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 12,
    height: 34,
    borderBottomWidth: 0.633,
  },
  backButton: {
    width: 32,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerFileName: {
    fontSize: 13,
    fontFamily: Fonts.sansMedium,
    flex: 1,
  },
  viewerMeta: {
    fontSize: 11,
    fontFamily: Fonts.sans,
  },
  viewerLine: {
    flexDirection: "row",
    paddingHorizontal: 8,
    minHeight: 20,
  },
  viewerLineNum: {
    width: 36,
    fontSize: 12,
    fontFamily: Fonts.mono,
    textAlign: "right",
    marginRight: 10,
    lineHeight: 20,
  },
  viewerLineText: {
    fontSize: 12,
    fontFamily: Fonts.mono,
    lineHeight: 20,
    flex: 1,
  },
});
