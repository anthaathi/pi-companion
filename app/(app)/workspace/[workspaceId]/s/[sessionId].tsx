import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  PanResponder,
  Platform,
  StyleSheet,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/theme";
import { useResponsiveLayout } from "@/features/navigation/hooks/use-responsive-layout";
import { ChangesPanel } from "@/features/workspace/components/changes-panel";
import { PromptInput } from "@/features/workspace/components/prompt-input";
import { useWorkspaceStore } from "@/features/workspace/store";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { MessageList } from "@/features/agent/components/message-list";
import { ChatShimmer } from "@/features/agent/components/message-list/chat-shimmer";
import {
  useAgentSession,
  useSendPrompt,
  useAbortAgent,
} from "@/features/agent/hooks/use-agent-session";
import { useAgentStore } from "@/features/agent/store";
import { useSessions } from "@/features/workspace/hooks/use-sessions";
import type { ChatMessage } from "@/features/agent/types";

const EMPTY_MESSAGES: ChatMessage[] = [];

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function SessionScreen() {
  const { workspaceId, sessionId } = useLocalSearchParams<{
    workspaceId: string;
    sessionId: string;
  }>();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const { isWideScreen } = useResponsiveLayout();
  const insets = useSafeAreaInsets();

  const selectWorkspace = useWorkspaceStore((s) => s.selectWorkspace);
  const setLastSession = useWorkspaceStore((s) => s.setLastSession);

  useEffect(() => {
    if (workspaceId) selectWorkspace(workspaceId);
  }, [workspaceId, selectWorkspace]);

  useEffect(() => {
    if (Platform.OS !== 'web' && workspaceId && sessionId) {
      setLastSession(workspaceId, sessionId);
    }
  }, [workspaceId, sessionId, setLastSession]);

  const { sessions } = useSessions(workspaceId ?? null);
  const session = (sessions as any[])?.find(
    (s: any) => s.id === sessionId,
  );
  const sessionFile = session?.file_path ?? null;

  const { isSessionReady } = useAgentSession(
    sessionId ?? null,
    workspaceId ?? null,
    sessionFile,
  );

  const isStreaming = useAgentStore(
    (s) => s.streaming[sessionId ?? ""] ?? false,
  );
  const messages = useAgentStore(
    (s) => s.messages[sessionId ?? ""] ?? EMPTY_MESSAGES,
  );

  const sendPromptMutation = useSendPrompt();
  const abortAgent = useAbortAgent();
  const sendRef = useRef(sendPromptMutation.mutate);
  sendRef.current = sendPromptMutation.mutate;

  const handleSend = useCallback(
    (text: string) => {
      if (!sessionId) return;
      sendRef.current({
        sessionId,
        message: text,
        streamingBehavior: isStreaming ? "steer" : undefined,
      });
    },
    [sessionId, isStreaming],
  );

  const handleAbort = useCallback(() => {
    if (!sessionId) return;
    abortAgent.mutate(sessionId);
  }, [sessionId, abortAgent]);

  const isDark = colorScheme === "dark";
  const editorBg = isDark ? "#151515" : "#FAFAFA";
  const sidebarBorder = isDark ? "#323131" : "rgba(0,0,0,0.08)";

  const PANEL_DEFAULT = 280;
  const PANEL_MIN = 180;
  const PANEL_MAX = 480;
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT);
  const panelWidthRef = useRef(PANEL_DEFAULT);
  const panelStartRef = useRef(PANEL_DEFAULT);

  const panelResizer = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        panelStartRef.current = panelWidthRef.current;
        if (Platform.OS === "web") {
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
        }
      },
      onPanResponderMove: (_e, gs) => {
        const newWidth = Math.max(
          PANEL_MIN,
          Math.min(PANEL_MAX, panelStartRef.current - gs.dx),
        );
        panelWidthRef.current = newWidth;
        setPanelWidth(newWidth);
      },
      onPanResponderRelease: () => {
        if (Platform.OS === "web") {
          document.body.style.cursor = "";
          document.body.style.userSelect = "";
        }
      },
      onPanResponderTerminate: () => {
        if (Platform.OS === "web") {
          document.body.style.cursor = "";
          document.body.style.userSelect = "";
        }
      },
    }),
  ).current;

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

  const hasMessages = messages.length > 0;
  const isLoadingHistory = !!sessionId && !hasMessages;

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
        <View style={[styles.editorColumn, { backgroundColor: editorBg }]}>
          {hasMessages && sessionId ? (
            <MessageList key={sessionId} sessionId={sessionId} />
          ) : isLoadingHistory ? (
            <ChatShimmer />
          ) : (
            <View style={styles.emptyCenter} />
          )}
          <PromptInput
            sessionId={sessionId}
            onSend={handleSend}
            isStreaming={isStreaming}
            onAbort={handleAbort}
            sessionReady={isSessionReady}
            disabled={!isSessionReady}
            allowTypingWhileDisabled
          />
        </View>

        {isWideScreen && (
          <View
            style={[
              styles.sidebarDivider,
              { borderLeftColor: sidebarBorder, width: panelWidth },
            ]}
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

      {/* Terminal stub removed */}
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
  emptyCenter: {
    flex: 1,
  },
  sidebarDivider: {
    borderLeftWidth: 0.633,
    flexDirection: "row",
    overflow: "hidden",
  },
  resizeHandle: {
    width: Platform.OS === "web" ? 6 : 12,
    cursor: "col-resize",
    alignSelf: "stretch",
  } as any,
});
