import { ChevronRight } from "lucide-react-native";
import Animated from "react-native-reanimated";

interface AnimatedChevronProps {
  style: any;
  color: string;
  size?: number;
}

export function AnimatedChevron({ style, color, size = 13 }: AnimatedChevronProps) {
  return (
    <Animated.View style={style}>
      <ChevronRight size={size} color={color} strokeWidth={1.8} />
    </Animated.View>
  );
}
