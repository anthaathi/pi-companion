import { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { X, Columns2, Rows2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAppSettingsStore, type DiffViewMode } from "@/features/settings/store";
import type { DiffOp, InlineRow, SideBySideRow } from "./code-preview";
import {
  CodePreview,
  SplitDiffView,
  TokenizedText,
  buildInline,
  buildSideBySide,
  editStyles,
  toolMetaStyles,
  type CodeRow,
} from "./code-preview";

interface DiffBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  path: string;
  ops: DiffOp[];
  /** For write tool - preview rows when no diff baseline */
  previewRows?: CodeRow[];
  infoText?: string | null;
  addBg?: string;
}

export function DiffBottomSheet({
  visible,
  onClose,
  title,
  path,
  ops,
  previewRows,
  infoText,
  addBg,
}: DiffBottomSheetProps) {
  const colorScheme = useColorScheme() ?? "light";
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const diffViewMode = useAppSettingsStore((s) => s.diffViewMode);
  const updateSettings = useAppSettingsStore((s) => s.update);
  const viewMode = diffViewMode;
  const setViewMode = (mode: DiffViewMode) => updateSettings({ diffViewMode: mode });

  const slideAnim = useRef(new Animated.Value(600)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 100, friction: 16, useNativeDriver: true }),
      ]).start();
    }
  }, [overlayAnim, slideAnim, visible]);

  const animateClose = () => {
    Animated.parallel([
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 600, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const textColor = isDark ? "#CCCCCC" : "#1A1A1A";
  const mutedColor = isDark ? "#888" : "#888";
  const bg = isDark ? "#1A1A1A" : "#FFFFFF";
  const headerBg = isDark ? "#222" : "#F5F5F5";
  const addColor = isDark ? "#3FB950" : "#1A7F37";
  const removeColor = isDark ? "#F85149" : "#CF222E";
  const lineNoBg = isDark ? "#111111" : "#F3F3F3";
  const lineNoColor = isDark ? "#444" : "#BBBBBB";
  const dividerColor = isDark ? "#2A2A2A" : "#E0E0E0";
  const emptyBg = isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)";
  const diffAddBg = addBg ?? (isDark ? "rgba(63, 185, 80, 0.10)" : "rgba(26, 127, 55, 0.06)");
  const removeBg = isDark ? "rgba(248, 81, 73, 0.10)" : "rgba(207, 34, 46, 0.06)";
  const activeBtnBg = isDark ? "#333" : "#FFFFFF";

  const hasOps = ops.length > 0;
  const inlineRows = hasOps && viewMode === "inline" ? buildInline(ops) : [];
  const sideBySideRows = hasOps && viewMode === "split" ? buildSideBySide(ops) : [];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={animateClose}>
      <View style={styles.modalWrap}>
        <Animated.View
          style={[styles.overlay, { opacity: overlayAnim }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={animateClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: bg,
              paddingBottom: insets.bottom,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { backgroundColor: headerBg }]}>
            <View style={styles.headerLeft}>
              <Text style={[styles.headerTitle, { color: textColor }]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={[styles.headerPath, { color: mutedColor }]} numberOfLines={1}>
                {path}
              </Text>
            </View>
            <View style={styles.headerRight}>
              {hasOps && (
                <View style={styles.viewToggle}>
                  <Pressable
                    onPress={() => setViewMode("inline")}
                    style={[styles.viewToggleBtn, viewMode === "inline" && { backgroundColor: activeBtnBg }]}
                  >
                    <Rows2 size={14} color={viewMode === "inline" ? textColor : mutedColor} strokeWidth={1.8} />
                  </Pressable>
                  <Pressable
                    onPress={() => setViewMode("split")}
                    style={[styles.viewToggleBtn, viewMode === "split" && { backgroundColor: activeBtnBg }]}
                  >
                    <Columns2 size={14} color={viewMode === "split" ? textColor : mutedColor} strokeWidth={1.8} />
                  </Pressable>
                </View>
              )}
              <Pressable onPress={animateClose} style={styles.closeBtn}>
                <X size={18} color={mutedColor} strokeWidth={2} />
              </Pressable>
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {infoText ? (
              <View style={toolMetaStyles.banner}>
                <Text style={[toolMetaStyles.text, { color: mutedColor }]}>{infoText}</Text>
              </View>
            ) : null}

            {hasOps && viewMode === "split" ? (
              <ScrollView style={styles.scrollArea} nestedScrollEnabled>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <SplitDiffView
                    rows={sideBySideRows}
                    containerWidth={400}
                    isDark={isDark}
                    removeBg={removeBg}
                    addBg={diffAddBg}
                    emptyBg={emptyBg}
                    lineNoBg={lineNoBg}
                    lineNoColor={lineNoColor}
                    dividerColor={dividerColor}
                  />
                </ScrollView>
              </ScrollView>
            ) : hasOps && viewMode === "inline" ? (
              <ScrollView style={styles.scrollArea} nestedScrollEnabled>
                <View>
                  {inlineRows.map((row, i) => {
                    const rowBg = row.type === "added" ? diffAddBg : row.type === "removed" ? removeBg : undefined;
                    const prefix = row.type === "added" ? "+" : row.type === "removed" ? "-" : " ";
                    const prefixColor = row.type === "added" ? addColor : row.type === "removed" ? removeColor : mutedColor;
                    return (
                      <View key={i} style={[editStyles.inlineRow, rowBg ? { backgroundColor: rowBg } : undefined]}>
                        <View style={[editStyles.lineNoCol, { backgroundColor: lineNoBg }]}> 
                          <Text style={[editStyles.lineNo, { color: lineNoColor }]}>{row.oldLineNo ?? ""}</Text>
                        </View>
                        <View style={[editStyles.lineNoCol, { backgroundColor: lineNoBg }]}> 
                          <Text style={[editStyles.lineNo, { color: lineNoColor }]}>{row.newLineNo ?? ""}</Text>
                        </View>
                        <Text style={[editStyles.prefix, { color: prefixColor }]}>{prefix}</Text>
                        <TokenizedText line={row.text} isDark={isDark} style={editStyles.lineText} />
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            ) : previewRows && previewRows.length > 0 ? (
              <CodePreview
                rows={previewRows}
                isDark={isDark}
                lineNoBg={lineNoBg}
                lineNoColor={lineNoColor}
                rowBackgroundColor={diffAddBg}
              />
            ) : (
              <View style={editStyles.pendingState}>
                <Text style={[editStyles.pendingText, { color: mutedColor }]}>No preview available</Text>
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: Fonts.sansSemiBold,
    fontWeight: "600",
  },
  headerPath: {
    fontSize: 11,
    fontFamily: Fonts.mono,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  viewToggle: {
    flexDirection: "row",
    borderRadius: 6,
    overflow: "hidden",
    gap: 2,
  },
  viewToggleBtn: {
    width: 30,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
});
