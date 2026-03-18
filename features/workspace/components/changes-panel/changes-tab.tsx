import { useCallback } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Plus,
  Minus,
  Undo2,
  ChevronDown,
  ChevronRight,
  Check,
} from "lucide-react-native";

import { Fonts } from "@/constants/theme";
import { FileRow } from "./file-row";
import { IconButton } from "./icon-button";
import { useChangesTheme } from "./use-theme-colors";

interface FileEntry {
  path: string;
  status: string;
  additions?: number;
  deletions?: number;
}

interface SelectedFile {
  path: string;
  staged: boolean;
}

export function ChangesTab({
  staged,
  unstaged,
  untracked,
  stagedOpen,
  unstagedOpen,
  untrackedOpen,
  onToggleStaged,
  onToggleUnstaged,
  onToggleUntracked,
  selectedFile,
  diffContent,
  diffLoading,
  onFilePress,
  onStage,
  onUnstage,
  onDiscard,
}: {
  staged: FileEntry[];
  unstaged: FileEntry[];
  untracked: string[];
  stagedOpen: boolean;
  unstagedOpen: boolean;
  untrackedOpen: boolean;
  onToggleStaged: () => void;
  onToggleUnstaged: () => void;
  onToggleUntracked: () => void;
  selectedFile: SelectedFile | null;
  diffContent: string | null | undefined;
  diffLoading: boolean;
  onFilePress: (path: string, staged: boolean) => void;
  onStage: (paths: string[]) => void;
  onUnstage: (paths: string[]) => void;
  onDiscard: (paths: string[]) => void;
}) {
  const { textPrimary, textMuted, sectionBg, hoverBg } = useChangesTheme();
  const totalChanges = staged.length + unstaged.length + untracked.length;

  const confirmDiscard = useCallback(
    (paths: string[]) => {
      const msg = `Discard changes to ${paths.length} file${paths.length !== 1 ? "s" : ""}? This cannot be undone.`;
      if (Platform.OS === "web") {
        if (window.confirm(msg)) onDiscard(paths);
      } else {
        Alert.alert("Discard Changes", msg, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => onDiscard(paths),
          },
        ]);
      }
    },
    [onDiscard],
  );

  if (totalChanges === 0) {
    return (
      <View style={styles.cleanState}>
        <Check size={20} color={textMuted} strokeWidth={2} />
        <Text style={[styles.emptyText, { color: textMuted }]}>
          Working tree clean
        </Text>
      </View>
    );
  }

  return (
    <>
      {staged.length > 0 && (
        <StagedSection
          files={staged}
          isOpen={stagedOpen}
          onToggle={onToggleStaged}
          selectedFile={selectedFile}
          diffContent={diffContent}
          diffLoading={diffLoading}
          onFilePress={onFilePress}
          onUnstage={onUnstage}
          textPrimary={textPrimary}
          textMuted={textMuted}
          sectionBg={sectionBg}
          hoverBg={hoverBg}
        />
      )}

      {unstaged.length > 0 && (
        <UnstagedSection
          files={unstaged}
          isOpen={unstagedOpen}
          onToggle={onToggleUnstaged}
          selectedFile={selectedFile}
          diffContent={diffContent}
          diffLoading={diffLoading}
          onFilePress={onFilePress}
          onStage={onStage}
          onDiscard={confirmDiscard}
          textPrimary={textPrimary}
          textMuted={textMuted}
          sectionBg={sectionBg}
          hoverBg={hoverBg}
        />
      )}

      {untracked.length > 0 && (
        <UntrackedSection
          files={untracked}
          isOpen={untrackedOpen}
          onToggle={onToggleUntracked}
          onStage={onStage}
          textPrimary={textPrimary}
          textMuted={textMuted}
          sectionBg={sectionBg}
          hoverBg={hoverBg}
        />
      )}
    </>
  );
}

function SectionChevron({
  open,
  color,
}: {
  open: boolean;
  color: string;
}) {
  return open ? (
    <ChevronDown size={14} color={color} strokeWidth={2} />
  ) : (
    <ChevronRight size={14} color={color} strokeWidth={2} />
  );
}

function StagedSection({
  files,
  isOpen,
  onToggle,
  selectedFile,
  diffContent,
  diffLoading,
  onFilePress,
  onUnstage,
  textPrimary,
  textMuted,
  sectionBg,
  hoverBg,
}: {
  files: FileEntry[];
  isOpen: boolean;
  onToggle: () => void;
  selectedFile: SelectedFile | null;
  diffContent: string | null | undefined;
  diffLoading: boolean;
  onFilePress: (path: string, staged: boolean) => void;
  onUnstage: (paths: string[]) => void;
  textPrimary: string;
  textMuted: string;
  sectionBg: string;
  hoverBg: string;
}) {
  return (
    <View style={styles.section}>
      <Pressable
        style={[styles.sectionHeader, { backgroundColor: sectionBg }]}
        onPress={onToggle}
      >
        <SectionChevron open={isOpen} color={textMuted} />
        <Text style={[styles.sectionTitle, { color: textPrimary }]}>
          Staged
        </Text>
        <Text style={[styles.sectionCount, { color: textMuted }]}>
          {files.length}
        </Text>
        <View style={{ flex: 1 }} />
        <IconButton
          onPress={() => onUnstage(files.map((f) => f.path))}
          title="Unstage all"
          icon={<Minus size={14} color={textMuted} strokeWidth={2} />}
        />
      </Pressable>
      {isOpen &&
        files.map((f) => {
          const isSelected =
            selectedFile?.path === f.path && selectedFile?.staged === true;
          return (
            <FileRow
              key={`s-${f.path}`}
              path={f.path}
              status={f.status}
              additions={f.additions}
              deletions={f.deletions}
              isSelected={isSelected}
              diffContent={isSelected ? diffContent : null}
              diffLoading={isSelected && diffLoading}
              onPress={() => onFilePress(f.path, true)}
              textPrimary={textPrimary}
              textMuted={textMuted}
              hoverBg={hoverBg}
              actions={
                <IconButton
                  onPress={() => onUnstage([f.path])}
                  title="Unstage"
                  icon={
                    <Minus size={13} color={textMuted} strokeWidth={2} />
                  }
                />
              }
            />
          );
        })}
    </View>
  );
}

function UnstagedSection({
  files,
  isOpen,
  onToggle,
  selectedFile,
  diffContent,
  diffLoading,
  onFilePress,
  onStage,
  onDiscard,
  textPrimary,
  textMuted,
  sectionBg,
  hoverBg,
}: {
  files: FileEntry[];
  isOpen: boolean;
  onToggle: () => void;
  selectedFile: SelectedFile | null;
  diffContent: string | null | undefined;
  diffLoading: boolean;
  onFilePress: (path: string, staged: boolean) => void;
  onStage: (paths: string[]) => void;
  onDiscard: (paths: string[]) => void;
  textPrimary: string;
  textMuted: string;
  sectionBg: string;
  hoverBg: string;
}) {
  return (
    <View style={styles.section}>
      <Pressable
        style={[styles.sectionHeader, { backgroundColor: sectionBg }]}
        onPress={onToggle}
      >
        <SectionChevron open={isOpen} color={textMuted} />
        <Text style={[styles.sectionTitle, { color: textPrimary }]}>
          Changes
        </Text>
        <Text style={[styles.sectionCount, { color: textMuted }]}>
          {files.length}
        </Text>
        <View style={{ flex: 1 }} />
        <IconButton
          onPress={() => onDiscard(files.map((f) => f.path))}
          title="Discard all changes"
          icon={<Undo2 size={13} color={textMuted} strokeWidth={2} />}
        />
        <IconButton
          onPress={() => onStage(files.map((f) => f.path))}
          title="Stage all changes"
          style={{ marginLeft: 4 }}
          icon={<Plus size={14} color={textMuted} strokeWidth={2} />}
        />
      </Pressable>
      {isOpen &&
        files.map((f) => {
          const isSelected =
            selectedFile?.path === f.path && selectedFile?.staged === false;
          return (
            <FileRow
              key={`u-${f.path}`}
              path={f.path}
              status={f.status}
              additions={f.additions}
              deletions={f.deletions}
              isSelected={isSelected}
              diffContent={isSelected ? diffContent : null}
              diffLoading={isSelected && diffLoading}
              onPress={() => onFilePress(f.path, false)}
              textPrimary={textPrimary}
              textMuted={textMuted}
              hoverBg={hoverBg}
              actions={
                <View style={styles.fileActions}>
                  <IconButton
                    onPress={() => onDiscard([f.path])}
                    title="Discard changes"
                    icon={
                      <Undo2 size={12} color={textMuted} strokeWidth={2} />
                    }
                  />
                  <IconButton
                    onPress={() => onStage([f.path])}
                    title="Stage"
                    icon={
                      <Plus size={13} color={textMuted} strokeWidth={2} />
                    }
                  />
                </View>
              }
            />
          );
        })}
    </View>
  );
}

function UntrackedSection({
  files,
  isOpen,
  onToggle,
  onStage,
  textPrimary,
  textMuted,
  sectionBg,
  hoverBg,
}: {
  files: string[];
  isOpen: boolean;
  onToggle: () => void;
  onStage: (paths: string[]) => void;
  textPrimary: string;
  textMuted: string;
  sectionBg: string;
  hoverBg: string;
}) {
  return (
    <View style={styles.section}>
      <Pressable
        style={[styles.sectionHeader, { backgroundColor: sectionBg }]}
        onPress={onToggle}
      >
        <SectionChevron open={isOpen} color={textMuted} />
        <Text style={[styles.sectionTitle, { color: textPrimary }]}>
          Untracked
        </Text>
        <Text style={[styles.sectionCount, { color: textMuted }]}>
          {files.length}
        </Text>
        <View style={{ flex: 1 }} />
        <IconButton
          onPress={() => onStage(files)}
          title="Stage all untracked"
          icon={<Plus size={14} color={textMuted} strokeWidth={2} />}
        />
      </Pressable>
      {isOpen &&
        files.map((p) => (
          <FileRow
            key={`t-${p}`}
            path={p}
            status="?"
            textPrimary={textPrimary}
            textMuted={textMuted}
            hoverBg={hoverBg}
            actions={
              <IconButton
                onPress={() => onStage([p])}
                title="Stage"
                icon={
                  <Plus size={13} color={textMuted} strokeWidth={2} />
                }
              />
            }
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cleanState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 48,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: Fonts.sans,
    textAlign: "center",
  },
  section: {
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 30,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: Fonts.sansSemiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 11,
    fontFamily: Fonts.sans,
  },
  fileActions: {
    flexDirection: "row",
    gap: 6,
  },
});
