import { useCallback, useState } from "react";
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";

const EXPAND_DURATION = 280;
const EXPAND_EASING = Easing.out(Easing.cubic);

interface UseExpandAnimationOptions {
  initialExpanded?: boolean;
}

export function useExpandAnimation(options?: UseExpandAnimationOptions) {
  const initialExpanded = options?.initialExpanded ?? false;
  const [expanded, setExpanded] = useState(initialExpanded);
  const [shouldRender, setShouldRender] = useState(initialExpanded);
  const measuredHeight = useSharedValue(0);
  const progress = useSharedValue(initialExpanded ? 1 : 0);
  const chevronRotation = useSharedValue(initialExpanded ? 1 : 0);

  const onMeasure = useCallback(
    (height: number) => {
      measuredHeight.value = height;
    },
    [measuredHeight],
  );

  const expand = useCallback(() => {
    setShouldRender(true);
    setExpanded(true);
    progress.value = withTiming(1, {
      duration: EXPAND_DURATION,
      easing: EXPAND_EASING,
    });
    chevronRotation.value = withTiming(1, {
      duration: 200,
      easing: EXPAND_EASING,
    });
  }, [progress, chevronRotation]);

  const collapse = useCallback(() => {
    setExpanded(false);
    progress.value = withTiming(
      0,
      { duration: EXPAND_DURATION, easing: EXPAND_EASING },
      (finished) => {
        if (finished) {
          runOnJS(setShouldRender)(false);
        }
      },
    );
    chevronRotation.value = withTiming(0, {
      duration: 200,
      easing: EXPAND_EASING,
    });
  }, [progress, chevronRotation]);

  const toggle = useCallback(() => {
    if (expanded) collapse();
    else expand();
  }, [expanded, expand, collapse]);

  const containerStyle = useAnimatedStyle(() => {
    const h = measuredHeight.value;
    return {
      height: h > 0 ? h * progress.value : undefined,
      opacity: progress.value,
      overflow: "hidden" as const,
    };
  });

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 90}deg` }],
  }));

  return {
    expanded,
    shouldRender,
    expand,
    collapse,
    toggle,
    onMeasure,
    containerStyle,
    chevronStyle,
  };
}
