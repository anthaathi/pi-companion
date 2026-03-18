import { useCallback, useEffect, useRef } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Pencil, Trash2 } from "lucide-react-native";

import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface WorkspaceContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function WorkspaceContextMenu({
  visible,
  x,
  y,
  onEdit,
  onDelete,
  onClose,
}: WorkspaceContextMenuProps) {
  const colorScheme = useColorScheme() ?? "light";
  const isDark = colorScheme === "dark";

  const textPrimary = isDark ? "#fefdfd" : Colors[colorScheme].text;
  const textDanger = "#E5484D";
  const menuBg = isDark ? "#252525" : "#FFFFFF";
  const menuBorder = isDark ? "#3b3a39" : "rgba(0,0,0,0.12)";
  const hoverBg = isDark ? "#333" : "#F0F0F0";

  const menuRef = useRef<View>(null);

  useEffect(() => {
    if (!visible || Platform.OS !== "web") return;
    const handler = () => onClose();
    document.addEventListener("click", handler);
    document.addEventListener("contextmenu", handler);
    return () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("contextmenu", handler);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <View
      ref={menuRef}
      style={[
        styles.menu,
        {
          top: y,
          left: x,
          backgroundColor: menuBg,
          borderColor: menuBorder,
        },
      ]}
    >
      <Pressable
        onPress={() => {
          onClose();
          onEdit();
        }}
        style={({ pressed, hovered }: any) => [
          styles.menuItem,
          (pressed || hovered) && { backgroundColor: hoverBg },
        ]}
      >
        <Pencil size={14} color={textPrimary} strokeWidth={1.8} />
        <Text style={[styles.menuText, { color: textPrimary }]}>Edit</Text>
      </Pressable>
      <View style={[styles.separator, { backgroundColor: menuBorder }]} />
      <Pressable
        onPress={() => {
          onClose();
          onDelete();
        }}
        style={({ pressed, hovered }: any) => [
          styles.menuItem,
          (pressed || hovered) && { backgroundColor: hoverBg },
        ]}
      >
        <Trash2 size={14} color={textDanger} strokeWidth={1.8} />
        <Text style={[styles.menuText, { color: textDanger }]}>Delete</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: "absolute",
    zIndex: 1000,
    minWidth: 160,
    borderRadius: 8,
    borderWidth: 0.633,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  menuText: {
    fontSize: 13,
    fontFamily: Fonts.sansMedium,
  },
  separator: {
    height: 0.633,
    marginHorizontal: 8,
  },
});
