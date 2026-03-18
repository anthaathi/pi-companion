import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export function DiffView({ diff }: { diff: string }) {
  const colorScheme = useColorScheme() ?? "light";
  const isDark = colorScheme === "dark";

  const lines = diff.split("\n");

  return (
    <ScrollView
      style={styles.diffScroll}
      nestedScrollEnabled
      showsVerticalScrollIndicator
    >
      {lines.map((line, i) => {
        let bg = "transparent";
        let color = isDark ? "#CCC" : "#333";

        if (line.startsWith("+") && !line.startsWith("+++")) {
          bg = isDark ? "rgba(38,162,105,0.15)" : "rgba(38,162,105,0.12)";
          color = isDark ? "#57D9A3" : "#1A7F37";
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          bg = isDark ? "rgba(229,72,77,0.15)" : "rgba(229,72,77,0.10)";
          color = isDark ? "#FF8B8B" : "#CF222E";
        } else if (line.startsWith("@@")) {
          color = isDark ? "#6E9ECF" : "#0550AE";
        } else if (
          line.startsWith("diff ") ||
          line.startsWith("index ") ||
          line.startsWith("---") ||
          line.startsWith("+++")
        ) {
          color = isDark ? "#8B8685" : "#888";
        }

        return (
          <View key={i} style={[styles.diffLine, { backgroundColor: bg }]}>
            <Text
              style={[
                styles.diffLineNum,
                { color: isDark ? "#555" : "#AAA" },
              ]}
            >
              {i + 1}
            </Text>
            <Text style={[styles.diffLineText, { color }]} numberOfLines={1}>
              {line || " "}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  diffScroll: {
    maxHeight: 280,
  },
  diffLine: {
    flexDirection: "row",
    paddingHorizontal: 8,
    minHeight: 18,
  },
  diffLineNum: {
    width: 32,
    fontSize: 11,
    fontFamily: Fonts.mono,
    textAlign: "right",
    marginRight: 8,
    lineHeight: 18,
  },
  diffLineText: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    lineHeight: 18,
    flexShrink: 0,
  },
});
