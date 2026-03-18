import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { STATUS_COLORS, statusLabel } from "./constants";
import { DiffView } from "./diff-view";

export function FileRow({
  path,
  status,
  additions,
  deletions,
  isSelected,
  diffContent,
  diffLoading,
  onPress,
  textPrimary,
  textMuted,
  hoverBg,
  actions,
}: {
  path: string;
  status: string;
  additions?: number;
  deletions?: number;
  isSelected?: boolean;
  diffContent?: string | null;
  diffLoading?: boolean;
  onPress?: () => void;
  textPrimary: string;
  textMuted: string;
  hoverBg: string;
  actions?: React.ReactNode;
}) {
  const colorScheme = useColorScheme() ?? "light";
  const isDark = colorScheme === "dark";
  const filename = path.split("/").pop() ?? path;
  const dir = path.includes("/")
    ? path.slice(0, path.lastIndexOf("/") + 1)
    : "";
  const badge = statusLabel(status);
  const badgeColor = STATUS_COLORS[badge] ?? textMuted;
  const selectedBg = isDark ? "#1e1e1e" : "#E8E8E8";

  return (
    <View>
      <Pressable
        onPress={onPress}
        {...{ title: path }}
        accessibilityLabel={`${path} (${status})`}
        style={({ pressed, hovered }: any) => [
          styles.fileRow,
          isSelected && { backgroundColor: selectedBg },
          !isSelected && (pressed || hovered) && { backgroundColor: hoverBg },
        ]}
      >
        <Text style={[styles.statusBadge, { color: badgeColor }]}>
          {badge}
        </Text>
        <View style={styles.fileName}>
          <Text
            style={[styles.fileNameText, { color: textPrimary }]}
            numberOfLines={1}
          >
            {filename}
          </Text>
          {dir.length > 0 && (
            <Text
              style={[styles.fileDirText, { color: textMuted }]}
              numberOfLines={1}
            >
              {dir}
            </Text>
          )}
        </View>
        {(additions != null || deletions != null) && (
          <View style={styles.lineStats}>
            {(additions ?? 0) > 0 && (
              <Text style={[styles.additionsStat, { color: "#26A269" }]}>
                +{additions}
              </Text>
            )}
            {(deletions ?? 0) > 0 && (
              <Text style={[styles.deletionsStat, { color: "#E5484D" }]}>
                -{deletions}
              </Text>
            )}
          </View>
        )}
        {actions && <View style={styles.fileActionsWrap}>{actions}</View>}
      </Pressable>
      {isSelected && (
        <View
          style={[
            styles.diffContainer,
            { backgroundColor: isDark ? "#111" : "#F4F4F4" },
          ]}
        >
          {diffLoading ? (
            <ActivityIndicator style={{ paddingVertical: 12 }} size="small" />
          ) : diffContent ? (
            <DiffView diff={diffContent} />
          ) : (
            <Text style={[styles.diffEmpty, { color: textMuted }]}>
              No diff available
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    minHeight: 30,
  },
  statusBadge: {
    fontSize: 11,
    fontFamily: Fonts.sansBold,
    width: 14,
    textAlign: "center",
  },
  fileName: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    overflow: "hidden",
  },
  fileNameText: {
    fontSize: 13,
    fontFamily: Fonts.sans,
    flexShrink: 0,
  },
  fileDirText: {
    fontSize: 11,
    fontFamily: Fonts.sans,
    flexShrink: 1,
  },
  fileActionsWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  lineStats: {
    flexDirection: "row",
    gap: 4,
    marginRight: 4,
  },
  additionsStat: {
    fontSize: 11,
    fontFamily: Fonts.sansMedium,
  },
  deletionsStat: {
    fontSize: 11,
    fontFamily: Fonts.sansMedium,
  },
  diffContainer: {
    marginHorizontal: 8,
    marginBottom: 4,
    borderRadius: 6,
    overflow: "hidden",
    maxHeight: 300,
  },
  diffEmpty: {
    fontSize: 12,
    fontFamily: Fonts.sans,
    textAlign: "center",
    paddingVertical: 12,
  },
});
