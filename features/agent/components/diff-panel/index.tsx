import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Columns2, Rows2, X } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as SecureStore from "expo-secure-store";

import { Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAppSettingsStore, type DiffViewMode } from "@/features/settings/store";
import type { ChatMessage, ToolCallInfo } from "../../types";
import { parseToolArguments, isToolCallActive } from "../message-list/tool-call-utils";
import {
  TokenizedText,
  PlainCodeText,
  SplitDiffView,
  CodePreview,
  buildInline,
  buildSideBySide,
  buildCodeRows,
  simpleDiff,
  editStyles,
  toolMetaStyles,
  type DiffOp,
} from "../message-list/code-preview";
import { useDiffPanel, type DiffTab } from "./context";
import { DiffTabBar } from "./tab-bar";

const PANEL_DEFAULT = 420;
const PANEL_MIN = 280;
const PANEL_MAX = 700;
const PANEL_WIDTH_KEY = "diff_panel_width";

const SPRING_CONFIG = { damping: 22, stiffness: 260, mass: 0.8 };

let panelWidthCache = PANEL_DEFAULT;
let panelWidthLoaded = false;

function clampWidth(width: number) {
  return Math.max(PANEL_MIN, Math.min(PANEL_MAX, Math.round(width)));
}

function parseStoredWidth(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return clampWidth(parsed);
}

async function loadStoredWidth() {
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage === "undefined") return null;
      return parseStoredWidth(localStorage.getItem(PANEL_WIDTH_KEY));
    }
    return parseStoredWidth(await SecureStore.getItemAsync(PANEL_WIDTH_KEY));
  } catch {
    return null;
  }
}

async function saveStoredWidth(width: number) {
  const value = String(clampWidth(width));
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(PANEL_WIDTH_KEY, value);
      return;
    }
    await SecureStore.setItemAsync(PANEL_WIDTH_KEY, value);
  } catch {}
}

interface DiffSidebarProps {
  messages: ChatMessage[];
}

export const DiffSidebar = memo(function DiffSidebar({
  messages,
}: DiffSidebarProps) {
  const colorScheme = useColorScheme() ?? "light";
  const isDark = colorScheme === "dark";
  const {
    isOpen,
    tabs,
    activeTabId,
    closeTab,
    selectTab,
    close,
  } = useDiffPanel();

  const [panelWidth, setPanelWidth] = useState(panelWidthCache);
  const panelWidthRef = useRef(panelWidthCache);
  const panelStartRef = useRef(panelWidthCache);
  const [isResizing, setIsResizing] = useState(false);

  const animatedWidth = useSharedValue(0);
  const animatedOpacity = useSharedValue(0);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!panelWidthLoaded) {
      loadStoredWidth().then((stored) => {
        if (cancelled) return;
        const w = stored ?? PANEL_DEFAULT;
        panelWidthCache = w;
        panelWidthLoaded = true;
        panelWidthRef.current = w;
        setPanelWidth(w);
      });
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      animatedWidth.value = withSpring(panelWidthRef.current, SPRING_CONFIG);
      animatedOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
    } else if (!isOpen && wasOpenRef.current) {
      animatedOpacity.value = withTiming(0, { duration: 150, easing: Easing.in(Easing.cubic) });
      animatedWidth.value = withSpring(0, SPRING_CONFIG);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, animatedWidth, animatedOpacity]);

  useEffect(() => {
    if (isOpen && !isResizing) {
      animatedWidth.value = withSpring(panelWidth, SPRING_CONFIG);
    }
  }, [panelWidth, isOpen, isResizing, animatedWidth]);

  const persistWidth = useCallback((width: number) => {
    const w = clampWidth(width);
    panelWidthCache = w;
    panelWidthLoaded = true;
    panelWidthRef.current = w;
    void saveStoredWidth(w);
  }, []);

  const panelResizer = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        panelStartRef.current = panelWidthRef.current;
        setIsResizing(true);
        if (Platform.OS === "web") {
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
        }
      },
      onPanResponderMove: (_e, gs) => {
        const newWidth = clampWidth(panelStartRef.current - gs.dx);
        panelWidthRef.current = newWidth;
        setPanelWidth(newWidth);
        animatedWidth.value = newWidth;
      },
      onPanResponderRelease: () => {
        setIsResizing(false);
        persistWidth(panelWidthRef.current);
        if (Platform.OS === "web") {
          document.body.style.cursor = "";
          document.body.style.userSelect = "";
        }
      },
      onPanResponderTerminate: () => {
        setIsResizing(false);
        persistWidth(panelWidthRef.current);
        if (Platform.OS === "web") {
          document.body.style.cursor = "";
          document.body.style.userSelect = "";
        }
      },
    }),
  ).current;

  const containerStyle = useAnimatedStyle(() => ({
    width: animatedWidth.value,
    opacity: animatedOpacity.value,
  }));

  const borderColor = isDark ? "#2A2A2A" : "#E0E0E0";
  const bg = isDark ? "#0F0F0F" : "#FAFAFA";
  const handleBg = isDark ? "#1A1A1A" : "#F3F3F3";
  const handleHoverBg = isDark ? "#222" : "#EAEAEA";
  const handleColor = isDark ? "#555" : "#CCC";

  const activeTc = useMemo(() => {
    if (!activeTabId) return undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      const tcs = messages[i].toolCalls;
      if (!tcs) continue;
      const tc = tcs.find((t) => t.id === activeTabId || t.previousId === activeTabId);
      if (tc) return tc;
    }
    return undefined;
  }, [activeTabId, messages]);

  const handleTabSelect = useCallback(
    (id: string) => {
      const tab = tabs.find((t) => t.id === id);
      if (tab) selectTab(tab);
    },
    [tabs, selectTab],
  );

  if (!isOpen && !wasOpenRef.current) return null;

  return (
    <Animated.View
      style={[
        s.container,
        containerStyle,
        { borderLeftColor: borderColor, backgroundColor: bg },
      ]}
    >
      <View
        {...panelResizer.panHandlers}
        style={[
          s.resizeHandle,
          {
            backgroundColor: handleBg,
            borderRightColor: borderColor,
          },
          isResizing && { backgroundColor: handleHoverBg },
        ]}
      >
        <View style={[s.resizeLine, { backgroundColor: handleColor }]} />
      </View>

      <View style={s.content}>
        <PanelHeader
          isDark={isDark}
          onClose={close}
        />

        {tabs.length > 1 && (
          <DiffTabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSelect={handleTabSelect}
            onClose={closeTab}
            isDark={isDark}
          />
        )}

        {activeTc ? (
          <ActiveDiffContent
            key={activeTabId}
            tc={activeTc}
            tab={tabs.find((t) => t.id === activeTabId)!}
            isDark={isDark}
          />
        ) : (
          <View style={s.emptyState}>
            <Text style={[s.emptyText, { color: isDark ? "#555" : "#BBB" }]}>
              No file selected
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
});

const PanelHeader = memo(function PanelHeader({
  isDark,
  onClose,
}: {
  isDark: boolean;
  onClose: () => void;
}) {
  const textColor = isDark ? "#CCCCCC" : "#1A1A1A";
  const mutedColor = isDark ? "#888" : "#888";
  const headerBg = isDark ? "#141414" : "#F5F5F5";
  const borderColor = isDark ? "#2A2A2A" : "#E0E0E0";

  return (
    <View style={[s.header, { backgroundColor: headerBg, borderBottomColor: borderColor }]}>
      <Text style={[s.headerTitle, { color: textColor }]}>Changes</Text>
      <Pressable
        onPress={onClose}
        style={({ hovered }: any) => [
          s.closeBtn,
          hovered && { backgroundColor: isDark ? "#2A2A2A" : "#E8E8E8" },
        ]}
      >
        <X size={14} color={mutedColor} strokeWidth={2} />
      </Pressable>
    </View>
  );
});

function ActiveDiffContent({
  tc,
  tab,
  isDark,
}: {
  tc: ToolCallInfo;
  tab: DiffTab;
  isDark: boolean;
}) {
  if (tab.toolName === "edit") {
    return <EditDiffContent tc={tc} tab={tab} isDark={isDark} />;
  }
  return <WriteDiffContent tc={tc} tab={tab} isDark={isDark} />;
}

function EditDiffContent({
  tc,
  tab,
  isDark,
}: {
  tc: ToolCallInfo;
  tab: DiffTab;
  isDark: boolean;
}) {
  const diffViewMode = useAppSettingsStore((s) => s.diffViewMode);
  const updateSettings = useAppSettingsStore((s) => s.update);
  const setViewMode = (mode: DiffViewMode) => updateSettings({ diffViewMode: mode });
  const [containerWidth, setContainerWidth] = useState(0);

  const parsed = parseToolArguments(tc.arguments);
  const oldText = parsed.oldText ?? "";
  const newText = parsed.newText ?? "";
  const isRunning = isToolCallActive(tc);

  const ops = useMemo(() => {
    if (!oldText && !newText) return [];
    return simpleDiff(oldText, newText);
  }, [oldText, newText]);

  return (
    <DiffBody
      ops={ops}
      isDark={isDark}
      path={tab.path}
      viewMode={diffViewMode}
      setViewMode={setViewMode}
      containerWidth={containerWidth}
      onLayout={(w) => setContainerWidth(w)}
      isRunning={isRunning}
      hasData={ops.length > 0}
    />
  );
}

function WriteDiffContent({
  tc,
  tab,
  isDark,
}: {
  tc: ToolCallInfo;
  tab: DiffTab;
  isDark: boolean;
}) {
  const parsed = parseToolArguments(tc.arguments);
  const newText = parsed.content ?? "";
  const isRunning = isToolCallActive(tc);
  const rows = useMemo(() => buildCodeRows(newText, 1), [newText]);

  const mutedColor = isDark ? "#888" : "#888";
  const lineNoBg = isDark ? "#111111" : "#F3F3F3";
  const lineNoColor = isDark ? "#444" : "#BBBBBB";
  const toolbarBg = isDark ? "#161616" : "#F3F3F3";
  const toolbarBorder = isDark ? "#2A2A2A" : "#E0E0E0";

  return (
    <View style={s.diffBody}>
      <View style={[s.toolbar, { backgroundColor: toolbarBg, borderBottomColor: toolbarBorder }]}>
        <Text style={[s.toolbarPath, { color: mutedColor }]} numberOfLines={1}>
          {tab.path}
        </Text>
      </View>

      {rows.length > 0 ? (
        <CodePreview
          rows={rows}
          isDark={isDark}
          lineNoBg={lineNoBg}
          lineNoColor={lineNoColor}
          scrollStyle={s.scrollArea}
        />
      ) : (
        <View style={s.pendingState}>
          <Text style={[s.pendingText, { color: mutedColor }]}>
            {isRunning ? "Writing file..." : "No content"}
          </Text>
        </View>
      )}
    </View>
  );
}

function DiffBody({
  ops,
  isDark,
  path,
  viewMode,
  setViewMode,
  containerWidth,
  onLayout,
  isRunning,
  hasData,
  canShowDiff = true,
  previewRows,
  infoText,
}: {
  ops: DiffOp[];
  isDark: boolean;
  path: string;
  viewMode: DiffViewMode;
  setViewMode: (mode: DiffViewMode) => void;
  containerWidth: number;
  onLayout: (width: number) => void;
  isRunning: boolean;
  hasData: boolean;
  canShowDiff?: boolean;
  previewRows?: ReturnType<typeof buildCodeRows>;
  infoText?: string | null;
}) {
  const textColor = isDark ? "#CCCCCC" : "#1A1A1A";
  const mutedColor = isDark ? "#888" : "#888";
  const addColor = isDark ? "#3FB950" : "#1A7F37";
  const removeColor = isDark ? "#F85149" : "#CF222E";
  const addBg = isDark ? "rgba(63, 185, 80, 0.10)" : "rgba(26, 127, 55, 0.06)";
  const removeBg = isDark ? "rgba(248, 81, 73, 0.10)" : "rgba(207, 34, 46, 0.06)";
  const lineNoBg = isDark ? "#111111" : "#F3F3F3";
  const lineNoColor = isDark ? "#444" : "#BBBBBB";
  const dividerColor = isDark ? "#2A2A2A" : "#E0E0E0";
  const emptyBg = isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)";
  const toolbarBg = isDark ? "#161616" : "#F3F3F3";
  const toolbarBorder = isDark ? "#2A2A2A" : "#E0E0E0";
  const activeBtnBg = isDark ? "#2A2A2A" : "#FFFFFF";

  const sideBySideRows = useMemo(() => {
    if (viewMode !== "split" || !hasData) return [];
    return buildSideBySide(ops);
  }, [viewMode, ops, hasData]);

  const inlineRows = useMemo(() => {
    if (viewMode !== "inline" || !hasData) return [];
    return buildInline(ops);
  }, [viewMode, ops, hasData]);

  return (
    <View
      style={s.diffBody}
      onLayout={(e) => onLayout(e.nativeEvent.layout.width)}
    >
      <View style={[s.toolbar, { backgroundColor: toolbarBg, borderBottomColor: toolbarBorder }]}>
        <Text style={[s.toolbarPath, { color: mutedColor }]} numberOfLines={1}>
          {path}
        </Text>
        <View style={s.viewToggle}>
          <Pressable
            onPress={() => setViewMode("inline")}
            style={[s.viewToggleBtn, viewMode === "inline" && { backgroundColor: activeBtnBg }]}
          >
            <Rows2 size={12} color={viewMode === "inline" ? textColor : mutedColor} strokeWidth={1.8} />
          </Pressable>
          <Pressable
            onPress={() => setViewMode("split")}
            style={[s.viewToggleBtn, viewMode === "split" && { backgroundColor: activeBtnBg }]}
          >
            <Columns2 size={12} color={viewMode === "split" ? textColor : mutedColor} strokeWidth={1.8} />
          </Pressable>
        </View>
      </View>

      {infoText ? (
        <View style={toolMetaStyles.banner}>
          <Text style={[toolMetaStyles.text, { color: mutedColor }]}>{infoText}</Text>
        </View>
      ) : null}

      {canShowDiff && hasData ? (
        <ScrollView style={s.scrollArea} nestedScrollEnabled>
          {viewMode === "split" ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <SplitDiffView
                rows={sideBySideRows}
                containerWidth={containerWidth}
                isDark={isDark}
                removeBg={removeBg}
                addBg={addBg}
                emptyBg={emptyBg}
                lineNoBg={lineNoBg}
                lineNoColor={lineNoColor}
                dividerColor={dividerColor}
                contextTextColor={textColor}
                addTextColor={addColor}
                removeTextColor={removeColor}
              />
            </ScrollView>
          ) : (
            <View>
              {inlineRows.map((row, i) => {
                const rowBg = row.type === "added" ? addBg : row.type === "removed" ? removeBg : undefined;
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
                    <PlainCodeText
                      line={row.text}
                      color={row.type === "added" ? addColor : row.type === "removed" ? removeColor : textColor}
                      style={editStyles.lineText}
                    />
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      ) : previewRows && previewRows.length > 0 ? (
        <CodePreview
          rows={previewRows}
          isDark={isDark}
          lineNoBg={lineNoBg}
          lineNoColor={lineNoColor}
          rowBackgroundColor={addBg}
          scrollStyle={s.scrollArea}
        />
      ) : (
        <View style={s.pendingState}>
          <Text style={[s.pendingText, { color: mutedColor }]}>
            {isRunning ? "Preparing diff..." : "No changes to display"}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderLeftWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    alignSelf: "stretch",
  },
  resizeHandle: {
    width: 6,
    borderRightWidth: 0.5,
    alignItems: "center",
    justifyContent: "center",
    cursor: "col-resize",
  } as any,
  resizeLine: {
    width: 2,
    height: 24,
    borderRadius: 1,
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 13,
    fontFamily: Fonts.sansSemiBold,
    fontWeight: "600",
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  diffBody: {
    flex: 1,
    minHeight: 0,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 0.633,
  },
  toolbarPath: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    flex: 1,
    marginRight: 8,
  },
  viewToggle: {
    flexDirection: "row",
    borderRadius: 4,
    overflow: "hidden",
    gap: 2,
  },
  viewToggleBtn: {
    width: 24,
    height: 20,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollArea: {
    flex: 1,
  },
  pendingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  pendingText: {
    fontSize: 13,
    fontFamily: Fonts.sans,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: Fonts.sans,
  },
});
