import { type ReactNode, useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";

const DURATION = 280;
const EASING = Easing.out(Easing.cubic);

interface AnimatedEntryProps {
  children: ReactNode;
  enabled?: boolean;
}

export function AnimatedEntry({ children, enabled = true }: AnimatedEntryProps) {
  const measuredHeight = useSharedValue(0);
  const progress = useSharedValue(0);
  const hasMeasured = useRef(false);
  const [ready, setReady] = useState(false);

  const containerStyle = useAnimatedStyle(() => {
    const p = progress.value;
    if (p >= 0.99) {
      return { opacity: 1 };
    }
    const h = measuredHeight.value;
    return {
      height: h > 0 ? h * p : 0,
      opacity: p,
      overflow: "hidden" as const,
    };
  });

  const handleMeasure = useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0 && !hasMeasured.current) {
        hasMeasured.current = true;
        measuredHeight.value = h;
        setReady(true);
        progress.value = withTiming(1, { duration: DURATION, easing: EASING });
      }
    },
    [measuredHeight, progress],
  );

  const handleGrowth = useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      const h = e.nativeEvent.layout.height;
      if (h > measuredHeight.value) {
        measuredHeight.value = h;
      }
    },
    [measuredHeight],
  );

  if (!enabled) return <>{children}</>;

  if (!ready) {
    return (
      <View style={styles.measure} pointerEvents="none">
        <View onLayout={handleMeasure}>{children}</View>
      </View>
    );
  }

  return (
    <Animated.View style={containerStyle}>
      <View onLayout={handleGrowth}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  measure: {
    position: "absolute",
    opacity: 0,
    zIndex: -1,
    alignSelf: "stretch",
    width: "100%",
  },
});
