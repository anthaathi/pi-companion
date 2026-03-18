import { Pressable, StyleSheet } from "react-native";

export function IconButton({
  onPress,
  title,
  icon,
  disabled,
  style,
}: {
  onPress: () => void;
  title: string;
  icon: React.ReactNode;
  disabled?: boolean;
  style?: any;
}) {
  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation?.();
        if (!disabled) onPress();
      }}
      hitSlop={6}
      disabled={disabled}
      accessibilityLabel={title}
      accessibilityRole="button"
      {...{ title }}
      style={({ pressed }: any) => [
        styles.iconButton,
        pressed && !disabled && { opacity: 0.5 },
        disabled && { opacity: 0.3 },
        style,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
});
