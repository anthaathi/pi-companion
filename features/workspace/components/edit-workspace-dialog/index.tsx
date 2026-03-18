import { useState, useRef, useCallback, useEffect } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useResponsiveLayout } from "@/features/navigation/hooks/use-responsive-layout";
import { useWorkspaceStore } from "../../store";
import { update2 } from "@/features/api/generated/sdk.gen";
import type { Workspace } from "../../types";

interface EditWorkspaceDialogProps {
  visible: boolean;
  workspace: Workspace | null;
  onClose: () => void;
}

export function EditWorkspaceDialog({
  visible,
  workspace,
  onClose,
}: EditWorkspaceDialogProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const { isWideScreen } = useResponsiveLayout();
  const insets = useSafeAreaInsets();

  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<TextInput>(null);

  const textPrimary = isDark ? "#fefdfd" : colors.text;
  const textMuted = isDark ? "#cdc8c5" : colors.textTertiary;
  const inputBg = isDark ? "#1a1a1a" : "#F6F6F6";
  const inputBorder = isDark ? "#3b3a39" : "rgba(0,0,0,0.12)";

  useEffect(() => {
    if (visible && workspace) {
      setName(workspace.title);
      setSaving(false);
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [visible, workspace]);

  const handleSave = useCallback(async () => {
    if (!workspace || !name.trim() || saving) return;
    setSaving(true);
    await update2({
      path: { id: workspace.id },
      body: { name: name.trim() },
    });
    await fetchWorkspaces();
    setSaving(false);
    onClose();
  }, [workspace, name, saving, fetchWorkspaces, onClose]);

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (e.nativeEvent.key === "Enter" && name.trim()) {
        e.preventDefault?.();
        handleSave();
      }
    },
    [name, handleSave],
  );

  const canSave = name.trim().length > 0 && name.trim() !== workspace?.title;

  const formContent = (
    <>
      <View style={styles.field}>
        <Text style={[styles.label, { color: textMuted }]}>
          Workspace Name
        </Text>
        <View
          style={[
            styles.inputRow,
            { backgroundColor: inputBg, borderColor: inputBorder },
          ]}
        >
          <TextInput
            ref={nameRef}
            style={[styles.input, { color: textPrimary }]}
            value={name}
            onChangeText={setName}
            onKeyPress={handleKeyPress}
            placeholder="My Project"
            placeholderTextColor={textMuted}
          />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: textMuted }]}>Path</Text>
        <Text style={[styles.pathText, { color: textPrimary }]}>
          {workspace?.path}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.cancelButton,
            { borderColor: inputBorder },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.cancelText, { color: textPrimary }]}>
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={!canSave || saving}
          style={({ pressed }) => [
            styles.saveButton,
            {
              backgroundColor: canSave
                ? isDark
                  ? "#fefdfd"
                  : colors.text
                : isDark
                  ? "#333"
                  : "#CCC",
            },
            pressed && canSave && { opacity: 0.8 },
          ]}
        >
          <Text
            style={[
              styles.saveText,
              {
                color: canSave
                  ? isDark
                    ? "#121212"
                    : "#FFFFFF"
                  : textMuted,
              },
            ]}
          >
            {saving ? "Saving..." : "Save"}
          </Text>
        </Pressable>
      </View>
    </>
  );

  if (!isWideScreen) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.sheetOverlay} onPress={onClose}>
            <Pressable
              style={[
                styles.sheetContainer,
                {
                  backgroundColor: isDark ? "#1e1e1e" : "#FFFFFF",
                  paddingBottom: insets.bottom + 20,
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.sheetHandle}>
                <View
                  style={[
                    styles.sheetHandleBar,
                    { backgroundColor: isDark ? "#555" : "#CCC" },
                  ]}
                />
              </View>
              <Text style={[styles.sheetTitle, { color: textPrimary }]}>
                Edit Workspace
              </Text>
              <ScrollView
                style={styles.sheetBody}
                contentContainerStyle={styles.sheetBodyContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {formContent}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[
            styles.dialog,
            { backgroundColor: isDark ? "#1e1e1e" : "#FFFFFF" },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: textPrimary }]}>
              Edit Workspace
            </Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && { opacity: 0.5 },
              ]}
            >
              <X size={18} color={textMuted} strokeWidth={2} />
            </Pressable>
          </View>
          {formContent}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 14,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: {
    fontSize: 17,
    fontFamily: Fonts.sansSemiBold,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.sansMedium,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 42,
    borderRadius: 8,
    borderWidth: 0.633,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.sans,
    outlineStyle: "none",
  } as any,
  pathText: {
    fontSize: 13,
    fontFamily: Fonts.sans,
    opacity: 0.7,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
  cancelButton: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 0.633,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 14,
    fontFamily: Fonts.sansMedium,
  },
  saveButton: {
    height: 36,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    fontSize: 14,
    fontFamily: Fonts.sansMedium,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: "visible",
  },
  sheetHandle: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  sheetHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sheetTitle: {
    fontSize: 17,
    fontFamily: Fonts.sansSemiBold,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  sheetBody: {
    maxHeight: 300,
  },
  sheetBodyContent: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
});
