import { useState, useEffect } from "react";
import {
  Bell,
  PanelLeft,
  Search,
} from "lucide-react-native";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { CommandPalette } from "../command-palette";

interface HeaderBarProps {
  onToggleSidebar: () => void;
  sidebarVisible: boolean;
}

export function HeaderBar({ onToggleSidebar, sidebarVisible }: HeaderBarProps) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const [paletteVisible, setPaletteVisible] = useState(false);

  // Ctrl+P / Cmd+P to open
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setPaletteVisible(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const bg = colors.background;
  const btnBg = isDark ? "#282727" : "#E8E8E8";
  const borderColor = isDark ? "#3b3a39" : "rgba(0,0,0,0.12)";
  const textPrimary = isDark ? "#fefdfd" : colors.text;
  const textMuted = isDark ? "#cdc8c5" : colors.textTertiary;
  const textDim = isDark ? "#afaca9" : colors.textTertiary;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Left: rail spacer + sidebar toggle */}
      <View style={styles.leftSection}>
        <View style={styles.railSpacer} />

        <Pressable
          onPress={onToggleSidebar}
          style={({ pressed }) => [
            styles.headerBtn,
            { backgroundColor: btnBg },
            pressed && { opacity: 0.7 },
          ]}
        >
          <PanelLeft size={16} color={textPrimary} strokeWidth={1.8} />
        </Pressable>
      </View>

      {/* Center: search bar */}
      <Pressable
        onPress={() => setPaletteVisible(true)}
        style={({ pressed }) => [
          styles.searchBar,
          { borderColor },
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={styles.searchLeft}>
          <Search size={14} color={textMuted} strokeWidth={2} />
          <Text style={[styles.searchText, { color: textMuted }]}>
            Search agent
          </Text>
        </View>
        <Text style={[styles.shortcutText, { color: textDim }]}>
          {Platform.OS === 'web' ? '\u2318P' : 'Search'}
        </Text>
      </Pressable>

      <CommandPalette
        visible={paletteVisible}
        onClose={() => setPaletteVisible(false)}
      />

      {/* Right: notification */}
      <View style={styles.rightSection}>
        <View>
          <Pressable style={styles.headerBtn}>
            <Bell size={16} color={textMuted} strokeWidth={1.8} />
          </Pressable>
          <View style={styles.greenDot} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  railSpacer: {
    width: 56,
  },
  headerBtn: {
    width: 32,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    width: 240,
    height: 24,
    borderRadius: 6,
    borderWidth: 0.633,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 6,
    paddingRight: 8,
  },
  searchLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  searchText: {
    fontSize: 13,
    fontFamily: Fonts.sans,
  },
  shortcutText: {
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  greenDot: {
    position: "absolute",
    top: 2,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#089b00",
  },
});
