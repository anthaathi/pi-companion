import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { useColorScheme } from "@/hooks/use-color-scheme";

function ShimmerBar({ width, delay = 0 }: { width: string | number; delay?: number }) {
  const colorScheme = useColorScheme() ?? "light";
  const isDark = colorScheme === "dark";
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [delay, opacity]);

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          width: width as any,
          backgroundColor: isDark ? "#252525" : "#EEEEEE",
          opacity,
        },
      ]}
    />
  );
}

function ShimmerBlock({ align }: { align: "left" | "right" }) {
  const isRight = align === "right";

  return (
    <View style={[styles.block, isRight && styles.blockRight]}>
      <View style={[styles.bubble, isRight ? styles.bubbleRight : styles.bubbleLeft]}>
        <ShimmerBar width="80%" delay={isRight ? 0 : 100} />
        {!isRight && <ShimmerBar width="60%" delay={200} />}
        {!isRight && <ShimmerBar width="90%" delay={300} />}
      </View>
    </View>
  );
}

export function ChatShimmer() {
  return (
    <View style={styles.container}>
      <ShimmerBlock align="right" />
      <ShimmerBlock align="left" />
      <ShimmerBlock align="right" />
      <ShimmerBlock align="left" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 20,
    maxWidth: 1080,
    alignSelf: "center",
    width: "100%",
  },
  block: {
    flexDirection: "row",
  },
  blockRight: {
    justifyContent: "flex-end",
  },
  bubble: {
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    maxWidth: "70%",
  },
  bubbleLeft: {
    alignSelf: "flex-start",
  },
  bubbleRight: {
    alignSelf: "flex-end",
    maxWidth: "50%",
  },
  bar: {
    height: 12,
    borderRadius: 6,
  },
});
