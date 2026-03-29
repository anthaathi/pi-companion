import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

interface ExpandableContentProps {
  shouldRender: boolean;
  containerStyle: any;
  onMeasure: (height: number) => void;
  children: ReactNode;
}

export function ExpandableContent({
  shouldRender,
  containerStyle,
  onMeasure,
  children,
}: ExpandableContentProps) {
  if (!shouldRender) return null;

  return (
    <View>
      <View
        style={measureStyles.hidden}
        pointerEvents="none"
      >
        <View
          onLayout={(e) => onMeasure(e.nativeEvent.layout.height)}
        >
          {children}
        </View>
      </View>
      <Animated.View style={containerStyle}>
        {children}
      </Animated.View>
    </View>
  );
}

const measureStyles = StyleSheet.create({
  hidden: {
    position: "absolute",
    opacity: 0,
    zIndex: -1,
    alignSelf: "stretch",
    width: "100%",
  },
});
