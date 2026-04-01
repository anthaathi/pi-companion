import type { ReactNode } from "react";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";

const ITEM_LAYOUT = LinearTransition.springify().damping(18).stiffness(180).mass(0.7);

export function AnimatedListItem({ children }: { children: ReactNode }) {
  return (
    <Animated.View
      layout={ITEM_LAYOUT}
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(140)}
    >
      {children}
    </Animated.View>
  );
}
