import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Fonts } from "@/constants/theme";
import { useAgentStore } from "../store";

export function ConnectionStatusBanner() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const connection = useAgentStore((s) => s.connection);
  const requestReconnect = useAgentStore((s) => s.requestReconnect);
  const visible =
    connection.status === "reconnecting" ||
    connection.status === "disconnected";

  const [mounted, setMounted] = useState(visible);
  const heightAnim = useRef(new Animated.Value(0)).current;

  const bottomPad = Platform.OS === "web" ? 0 : Math.max(insets.bottom, 6);
  const isCompact = width < 420;
  const stripHeight = (isCompact ? 84 : 54) + bottomPad;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(heightAnim, {
        toValue: stripHeight,
        duration: 200,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(heightAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [heightAnim, visible, stripHeight]);

  const handleTap = useCallback(() => {
    requestReconnect();
  }, [requestReconnect]);

  if (!mounted) return null;

  let message = "Server disconnected";
  if (connection.status === "reconnecting") {
    message =
      connection.retryAttempt > 1
        ? `Reconnecting… (attempt ${connection.retryAttempt})`
        : "Reconnecting…";
  } else if (connection.lastDisconnectReason) {
    message = connection.lastDisconnectReason;
  }

  return (
    <Animated.View
      style={[
        styles.strip,
        { height: heightAnim, paddingBottom: bottomPad },
      ]}
    >
      <View style={[styles.content, isCompact && styles.contentCompact]}>
        <Text style={styles.text} numberOfLines={isCompact ? 2 : 1}>
          {message}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={handleTap}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryButtonPressed,
          ]}
        >
          <Text style={styles.retryButtonText}>
            {connection.status === "reconnecting" ? "Retry now" : "Retry"}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  strip: {
    backgroundColor: "#C73D32",
    overflow: "hidden",
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
  },
  contentCompact: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "stretch",
    paddingVertical: 10,
  },
  text: {
    color: "#FFFFFF",
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  retryButton: {
    minHeight: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  retryButtonPressed: {
    opacity: 0.85,
  },
  retryButtonText: {
    color: "#A22E26",
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 0.2,
  },
});
