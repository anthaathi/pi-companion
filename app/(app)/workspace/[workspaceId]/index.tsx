import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Fonts } from "@/constants/theme";
import { useResponsiveLayout } from "@/features/navigation/hooks/use-responsive-layout";
import { ChangesPanel } from "@/features/workspace/components/changes-panel";
import { PromptInput } from "@/features/workspace/components/prompt-input";
import { WorkspaceHero } from "@/features/workspace/components/workspace-hero";
import { useWorkspaceStore } from "@/features/workspace/store";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useCreateSession, useSendPrompt } from "@/features/agent/hooks/use-agent-session";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function WorkspaceScreen() {
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { isWideScreen } = useResponsiveLayout();
  const insets = useSafeAreaInsets();

  const selectWorkspace = useWorkspaceStore((s) => s.selectWorkspace);
  const createSession = useCreateSession();
  const sendPrompt = useSendPrompt();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (workspaceId) {
      selectWorkspace(workspaceId);
    }
  }, [workspaceId, selectWorkspace]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!workspaceId || sending) return;
      setSending(true);
      try {
        const info = await createSession.mutateAsync({ workspaceId });
        const sessionId = info.session_id;
        await sendPrompt.mutateAsync({ sessionId, message: text });
        router.replace(`/workspace/${workspaceId}/s/${sessionId}`);
      } catch (e) {
        console.error('Failed to create session or send prompt:', e);
        setSending(false);
      }
    },
    [workspaceId, sending, createSession, sendPrompt, router],
  );

  const isDark = colorScheme === "dark";
  const editorBg = isDark ? "#151515" : "#FAFAFA";
  const sidebarBorder = isDark ? "#323131" : "rgba(0,0,0,0.08)";

  // Resizable changes panel
  const PANEL_DEFAULT = 280;
  const PANEL_MIN = 180;
  const PANEL_MAX = 480;
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT);
  const [isPanelResizing, setIsPanelResizing] = useState(false);
  const panelWidthRef = useRef(PANEL_DEFAULT);
  const panelStartRef = useRef(PANEL_DEFAULT);

  const panelResizer = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      panelStartRef.current = panelWidthRef.current;
      setIsPanelResizing(true);
      if (Platform.OS === 'web') {
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      }
    },
    onPanResponderMove: (_e, gs) => {
      // Drag left = increase width (panel is on the right)
      const newWidth = Math.max(PANEL_MIN, Math.min(PANEL_MAX, panelStartRef.current - gs.dx));
      panelWidthRef.current = newWidth;
      setPanelWidth(newWidth);
    },
    onPanResponderRelease: () => {
      setIsPanelResizing(false);
      if (Platform.OS === 'web') {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    },
    onPanResponderTerminate: () => {
      setIsPanelResizing(false);
      if (Platform.OS === 'web') {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    },
  })).current;

  const keyboardPadding = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === "web") return;

    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.spring(keyboardPadding, {
        toValue: e.endCoordinates.height,
        tension: 160,
        friction: 20,
        useNativeDriver: false,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      Animated.spring(keyboardPadding, {
        toValue: 0,
        tension: 160,
        friction: 20,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? "#121212" : colors.background,
          paddingBottom: isWideScreen
            ? 0
            : Animated.add(keyboardPadding, insets.bottom),
        },
      ]}
    >
      <View style={styles.upperRow}>
        {/* Editor area */}
        <View style={[styles.editorColumn, { backgroundColor: editorBg }]}>
          {sending ? (
            <View style={styles.sendingContainer}>
              <ActivityIndicator size="small" color={isDark ? '#cdc8c5' : colors.textTertiary} />
              <Text style={[styles.sendingText, { color: isDark ? '#cdc8c5' : colors.textTertiary }]}>
                Starting session…
              </Text>
            </View>
          ) : (
            <WorkspaceHero />
          )}
          <PromptInput onSend={handleSend} disabled={sending} />
        </View>

        {/* Right sidebar */}
        {isWideScreen && (
          <View
            style={[styles.sidebarDivider, { borderLeftColor: sidebarBorder, width: panelWidth }]}
          >
            <View
              {...panelResizer.panHandlers}
              hitSlop={{ left: 8, right: 8 }}
              style={[styles.resizeHandle, { backgroundColor: editorBg }]}
            />
            <View style={{ flex: 1 }}>
              <ChangesPanel />
            </View>
          </View>
        )}
      </View>

      {/* Terminal panel */}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  upperRow: {
    flex: 1,
    flexDirection: "row",
  },
  editorColumn: {
    flex: 1,
  },
  sendingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  sendingText: {
    fontSize: 14,
    fontFamily: Fonts.sansMedium,
  },
  sidebarDivider: {
    borderLeftWidth: 0.633,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  resizeHandle: {
    width: Platform.OS === 'web' ? 6 : 12,
    cursor: 'col-resize',
    alignSelf: 'stretch',
  } as any,
});
