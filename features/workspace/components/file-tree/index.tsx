import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  ArrowLeft,
  Upload,
  Download,
  FilePlus,
  FolderPlus,
  Trash2,
  X,
  Check,
} from "lucide-react-native";

import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  useFileList,
  useFileRead,
  usePiClient,
} from "@pi-ui/client";
import type { FsEntry } from "@pi-ui/client";
import {
  pickAndUploadFiles,
  downloadFile,
  type UploadProgressSnapshot,
} from "@/features/files/utils/file-transfer";

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
  /** Show the action bar with upload/create/download buttons */
  showActions?: boolean;
}

export function FileTree({
  rootPath,
  viewingFile,
  onViewFile,
  expandedDirs,
  onToggleDir,
  showActions = false,
}: FileTreeProps) {
  const colorScheme = useColorScheme() ?? "light";
  const isDark = colorScheme === "dark";
  const textMuted = isDark ? "#cdc8c5" : Colors[colorScheme].textTertiary;
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  if (viewingFile) {
    return (
      <FileViewer
        filePath={viewingFile}
        onBack={() => onViewFile(null)}
        onRefresh={handleRefresh}
        showActions={showActions}
      />
    );
  }

  return (
    <View style={styles.treeContainer}>
      {showActions && (
        <FileActionBar rootPath={rootPath} onRefresh={handleRefresh} />
      )}
      <FileTreeRoot
        rootPath={rootPath}
        refreshKey={refreshKey}
        textMuted={textMuted}
        onFilePress={(p) => onViewFile(p)}
        expandedDirs={expandedDirs}
        onToggleDir={onToggleDir}
        onRefresh={handleRefresh}
        showActions={showActions}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Action bar: Upload, New File, New Folder
// ---------------------------------------------------------------------------

function FileActionBar({
  rootPath,
  onRefresh,
}: {
  rootPath: string;
  onRefresh: () => void;
}) {
  const colorScheme = useColorScheme() ?? "light";
  const isDark = colorScheme === "dark";
  const colors = Colors[colorScheme];
  const { api } = usePiClient();

  const textMuted = isDark ? "#8B8685" : colors.textTertiary;
  const textPrimary = isDark ? "#fefdfd" : colors.text;
  const barBg = isDark ? "#1a1a1a" : "#F0F0F0";
  const barBorder = isDark ? "#323131" : "rgba(0,0,0,0.08)";
  const hoverBg = isDark ? "#252525" : "#E8E8E8";
  const progressTrack = isDark ? "#2a2a2a" : "#E5E5E5";
  const progressFill = isDark ? "#6E8DFF" : "#4F46E5";

  const [showNewFile, setShowNewFile] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressSnapshot | null>(null);

  const isUploading = !!uploadProgress?.uploading;

  const handleUpload = useCallback(async () => {
    try {
      const uploaded = await pickAndUploadFiles(api, rootPath, setUploadProgress);
      if (uploaded.length > 0) {
        onRefresh();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    }
  }, [api, rootPath, onRefresh]);

  const handleCreateFile = useCallback(async () => {
    if (!newName.trim() || creating || isUploading) return;
    setCreating(true);
    try {
      const path = `${rootPath.replace(/\/$/, "")}/${newName.trim()}`;
      await api.fsWrite(path, "");
      setShowNewFile(false);
      setNewName("");
      onRefresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create file";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setCreating(false);
    }
  }, [api, rootPath, newName, creating, isUploading, onRefresh]);

  const handleCreateFolder = useCallback(async () => {
    if (!newName.trim() || creating || isUploading) return;
    setCreating(true);
    try {
      const path = `${rootPath.replace(/\/$/, "")}/${newName.trim()}`;
      await api.fsMkdir(path);
      setShowNewFolder(false);
      setNewName("");
      onRefresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create folder";
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setCreating(false);
    }
  }, [api, rootPath, newName, creating, isUploading, onRefresh]);

  const cancelInline = useCallback(() => {
    setShowNewFile(false);
    setShowNewFolder(false);
    setNewName("");
  }, []);

  return (
    <View style={[styles.actionBar, { backgroundColor: barBg, borderBottomColor: barBorder }]}>
      {showNewFile || showNewFolder ? (
        <View style={styles.inlineCreateRow}>
          <TextInput
            style={[
              styles.inlineInput,
              {
                color: isDark ? "#fefdfd" : colors.text,
                backgroundColor: isDark ? "#252525" : "#FFFFFF",
                borderColor: barBorder,
              },
            ]}
            placeholder={showNewFile ? "file-name.txt" : "folder-name"}
            placeholderTextColor={textMuted}
            value={newName}
            onChangeText={setNewName}
            autoFocus
            editable={!isUploading}
            onSubmitEditing={showNewFile ? handleCreateFile : handleCreateFolder}
          />
          <Pressable
            onPress={showNewFile ? handleCreateFile : handleCreateFolder}
            disabled={!newName.trim() || creating || isUploading}
            style={({ pressed, hovered }: any) => [
              styles.actionBtn,
              (pressed || hovered) && { backgroundColor: hoverBg },
              (!newName.trim() || creating || isUploading) && { opacity: 0.4 },
            ]}
          >
            {creating ? (
              <ActivityIndicator size={12} />
            ) : (
              <Check size={14} color="#34C759" strokeWidth={2} />
            )}
          </Pressable>
          <Pressable
            onPress={cancelInline}
            disabled={isUploading}
            style={({ pressed, hovered }: any) => [
              styles.actionBtn,
              (pressed || hovered) && { backgroundColor: hoverBg },
              isUploading && { opacity: 0.4 },
            ]}
          >
            <X size={14} color={textMuted} strokeWidth={2} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.actionBtnRow}>
          <Pressable
            onPress={handleUpload}
            disabled={isUploading || creating}
            style={({ pressed, hovered }: any) => [
              styles.actionBtn,
              (pressed || hovered) && { backgroundColor: hoverBg },
              (isUploading || creating) && { opacity: 0.4 },
            ]}
            accessibilityLabel="Upload file"
            {...{ title: "Upload file" }}
          >
            {isUploading ? (
              <ActivityIndicator size={12} />
            ) : (
              <Upload size={14} color={textMuted} strokeWidth={1.8} />
            )}
          </Pressable>
          <Pressable
            onPress={() => {
              setShowNewFile(true);
              setShowNewFolder(false);
              setNewName("");
            }}
            disabled={isUploading}
            style={({ pressed, hovered }: any) => [
              styles.actionBtn,
              (pressed || hovered) && { backgroundColor: hoverBg },
              isUploading && { opacity: 0.4 },
            ]}
            accessibilityLabel="New file"
            {...{ title: "New file" }}
          >
            <FilePlus size={14} color={textMuted} strokeWidth={1.8} />
          </Pressable>
          <Pressable
            onPress={() => {
              setShowNewFolder(true);
              setShowNewFile(false);
              setNewName("");
            }}
            disabled={isUploading}
            style={({ pressed, hovered }: any) => [
              styles.actionBtn,
              (pressed || hovered) && { backgroundColor: hoverBg },
              isUploading && { opacity: 0.4 },
            ]}
            accessibilityLabel="New folder"
            {...{ title: "New folder" }}
          >
            <FolderPlus size={14} color={textMuted} strokeWidth={1.8} />
          </Pressable>
        </View>
      )}

      {!!uploadProgress && uploadProgress.items.length > 0 && (
        <View style={[styles.uploadPanel, { borderTopColor: barBorder }]}>
          <View style={styles.uploadHeaderRow}>
            <Text style={[styles.uploadHeaderText, { color: textPrimary }]}>
              Uploading {uploadProgress.completed}/{uploadProgress.total}
            </Text>
            <Text style={[styles.uploadHeaderMeta, { color: textMuted }]}>
              {uploadProgress.totalProgress}%
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: progressTrack }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: progressFill, width: `${uploadProgress.totalProgress}%` },
              ]}
            />
          </View>
          <View style={styles.uploadList}>
            {uploadProgress.items.slice(0, 4).map((item) => (
              <View key={item.id} style={styles.uploadItemRow}>
                <Text style={[styles.uploadItemName, { color: textPrimary }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text
                  style={[
                    styles.uploadItemMeta,
                    { color: item.status === "error" ? "#E5484D" : textMuted },
                  ]}
                  numberOfLines={1}
                >
                  {item.status === "success"
                    ? "Done"
                    : item.status === "error"
                      ? item.error ?? "Failed"
                      : `${item.progress}%`}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// File tree root
// ---------------------------------------------------------------------------

function FileTreeRoot({
  rootPath,
  refreshKey,
  textMuted,
  onFilePress,
  expandedDirs,
  onToggleDir,
  onRefresh,
  showActions,
}: {
  rootPath: string;
  refreshKey: number;
  textMuted: string;
  onFilePress: (path: string) => void;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
  onRefresh: () => void;
  showActions?: boolean;
}) {
  const { entries, isLoading, error } = useFileList(rootPath, refreshKey);

  if (isLoading) {
    return <ActivityIndicator style={{ marginTop: 32 }} />;
  }

  if (error) {
    return (
      <Text style={[styles.emptyText, { color: textMuted }]}>
        Failed to load: {error}
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
          onRefresh={onRefresh}
          refreshKey={refreshKey}
          showActions={showActions}
        />
      ))}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// File tree node
// ---------------------------------------------------------------------------

function FileTreeNode({
  entry,
  depth,
  onFilePress,
  expandedDirs,
  onToggleDir,
  onRefresh,
  refreshKey,
  showActions,
}: {
  entry: FsEntry;
  depth: number;
  onFilePress: (path: string) => void;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
  onRefresh: () => void;
  refreshKey: number;
  showActions?: boolean;
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
  const { api } = usePiClient();

  const handlePress = useCallback(() => {
    if (entry.is_dir) {
      onToggleDir(entry.path);
    } else {
      onFilePress(entry.path);
    }
  }, [entry, onFilePress, onToggleDir]);

  const handleDelete = useCallback(() => {
    const doDelete = async () => {
      try {
        await api.fsDelete(entry.path);
        onRefresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Delete failed";
        if (Platform.OS === "web") {
          // eslint-disable-next-line no-alert
          window.alert(msg);
        } else {
          Alert.alert("Error", msg);
        }
      }
    };

    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (window.confirm(`Delete "${entry.name}"?`)) {
        doDelete();
      }
    } else {
      Alert.alert("Delete", `Delete "${entry.name}"?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  }, [api, entry, onRefresh]);

  return (
    <View>
      <View style={styles.nodeRow}>
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
        {showActions && (
          <Pressable
            onPress={handleDelete}
            style={({ pressed, hovered }: any) => [
              styles.inlineDeleteBtn,
              (pressed || hovered) && { backgroundColor: hoverBg },
            ]}
            accessibilityLabel={`Delete ${entry.name}`}
            {...{ title: `Delete ${entry.name}` }}
          >
            <Trash2 size={12} color="#E5484D" strokeWidth={1.8} />
          </Pressable>
        )}
      </View>
      {expanded && (
        <ExpandedDir
          dirPath={entry.path}
          depth={depth + 1}
          onFilePress={onFilePress}
          expandedDirs={expandedDirs}
          onToggleDir={onToggleDir}
          onRefresh={onRefresh}
          refreshKey={refreshKey}
          showActions={showActions}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Expanded dir
// ---------------------------------------------------------------------------

function ExpandedDir({
  dirPath,
  depth,
  onFilePress,
  expandedDirs,
  onToggleDir,
  onRefresh,
  refreshKey,
  showActions,
}: {
  dirPath: string;
  depth: number;
  onFilePress: (path: string) => void;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
  onRefresh: () => void;
  refreshKey: number;
  showActions?: boolean;
}) {
  const colorScheme = useColorScheme() ?? "light";
  const isDark = colorScheme === "dark";
  const textMuted = isDark ? "#cdc8c5" : Colors[colorScheme].textTertiary;

  const { entries, isLoading } = useFileList(dirPath, refreshKey);

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
          onRefresh={onRefresh}
          refreshKey={refreshKey}
          showActions={showActions}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// File viewer with download button
// ---------------------------------------------------------------------------

function FileViewer({
  filePath,
  onBack,
  onRefresh,
  showActions,
}: {
  filePath: string;
  onBack: () => void;
  onRefresh: () => void;
  showActions?: boolean;
}) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const { api } = usePiClient();

  const textPrimary = isDark ? "#fefdfd" : colors.text;
  const textMuted = isDark ? "#cdc8c5" : colors.textTertiary;
  const headerBg = isDark ? "#1a1a1a" : "#F0F0F0";
  const headerBorder = isDark ? "#323131" : "rgba(0,0,0,0.08)";
  const lineBg = isDark ? "#111" : "#F8F8F8";
  const lineNumColor = isDark ? "#555" : "#AAA";
  const hoverBg = isDark ? "#252525" : "#E8E8E8";

  const fileName = filePath.split("/").pop() ?? filePath;

  const { data: fileData, isLoading, error: fileError } = useFileRead(filePath);

  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadFile(api, filePath, fileName);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Download failed";
      if (Platform.OS === "web") {
        // eslint-disable-next-line no-alert
        window.alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setDownloading(false);
    }
  }, [api, filePath, fileName, downloading]);

  const handleDelete = useCallback(() => {
    const doDelete = async () => {
      try {
        await api.fsDelete(filePath);
        onRefresh();
        onBack();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Delete failed";
        if (Platform.OS === "web") {
          // eslint-disable-next-line no-alert
          window.alert(msg);
        } else {
          Alert.alert("Error", msg);
        }
      }
    };

    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (window.confirm(`Delete "${fileName}"?`)) {
        doDelete();
      }
    } else {
      Alert.alert("Delete", `Delete "${fileName}"?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  }, [api, filePath, fileName, onBack, onRefresh]);

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
        {showActions && (
          <>
            <Pressable
              onPress={handleDownload}
              disabled={downloading}
              accessibilityLabel="Download file"
              {...{ title: "Download file" }}
              style={({ pressed, hovered }: any) => [
                styles.viewerActionBtn,
                (pressed || hovered) && { backgroundColor: hoverBg },
                downloading && { opacity: 0.5 },
              ]}
            >
              {downloading ? (
                <ActivityIndicator size={12} />
              ) : (
                <Download size={13} color={textMuted} strokeWidth={1.8} />
              )}
            </Pressable>
            <Pressable
              onPress={handleDelete}
              accessibilityLabel="Delete file"
              {...{ title: "Delete file" }}
              style={({ pressed, hovered }: any) => [
                styles.viewerActionBtn,
                (pressed || hovered) && { backgroundColor: hoverBg },
              ]}
            >
              <Trash2 size={13} color="#E5484D" strokeWidth={1.8} />
            </Pressable>
          </>
        )}
      </View>

      {/* Scrollable content */}
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : fileError ? (
        <View style={styles.viewerMessageWrap}>
          <Text style={[styles.emptyText, { color: textMuted }]}> 
            {fileError.includes("non-UTF8")
              ? "Binary file preview is not available. Use download to open it."
              : "Cannot read file"}
          </Text>
        </View>
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  treeContainer: {
    flex: 1,
  },
  content: {
    paddingBottom: 12,
  },
  nodeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingRight: 8,
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

  // Action bar
  actionBar: {
    minHeight: 34,
    paddingHorizontal: 8,
    justifyContent: "center",
    borderBottomWidth: 0.633,
  },
  actionBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineCreateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
  },
  inlineInput: {
    flex: 1,
    height: 26,
    borderRadius: 5,
    borderWidth: 0.633,
    paddingHorizontal: 8,
    fontSize: 12,
    fontFamily: Fonts.mono,
  },
  inlineDeleteBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  uploadPanel: {
    marginTop: 6,
    paddingTop: 8,
    paddingBottom: 6,
    borderTopWidth: 0.633,
    gap: 6,
  },
  uploadHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  uploadHeaderText: {
    fontSize: 12,
    fontFamily: Fonts.sansMedium,
  },
  uploadHeaderMeta: {
    fontSize: 11,
    fontFamily: Fonts.mono,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  uploadList: {
    gap: 4,
  },
  uploadItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  uploadItemName: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
  uploadItemMeta: {
    maxWidth: 140,
    fontSize: 11,
    fontFamily: Fonts.sans,
    textAlign: "right",
  },

  // File viewer
  viewerContainer: {
    flex: 1,
  },
  viewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 8,
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
  viewerActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerMessageWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
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
