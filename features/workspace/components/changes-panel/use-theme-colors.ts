import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export function useChangesTheme() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";

  return {
    isDark,
    colors,
    surfaceBg: isDark ? "#151515" : "#FAFAFA",
    tabContainerBg: isDark ? "#282727" : "#E8E8E8",
    tabActiveBg: isDark ? "#3b3a39" : "#D4D4D4",
    tabBorder: isDark ? "#3b3a39" : "rgba(0,0,0,0.12)",
    dividerColor: isDark ? "#323131" : "rgba(0,0,0,0.08)",
    textPrimary: isDark ? "#fefdfd" : colors.text,
    textSecondary: isDark ? "#f1ece8" : colors.textSecondary,
    textMuted: isDark ? "#cdc8c5" : colors.textTertiary,
    sectionBg: isDark ? "#1a1a1a" : "#F0F0F0",
    hoverBg: isDark ? "#252525" : "#E8E8E8",
    inputBg: isDark ? "#1a1a1a" : "#F6F6F6",
    inputBorder: isDark ? "#3b3a39" : "rgba(0,0,0,0.12)",
    sendColor: isDark ? "#fefdfd" : colors.text,
    hashColor: isDark ? "#8B8685" : "#888",
    selectedBg: isDark ? "#1e1e1e" : "#E8E8E8",
  };
}
