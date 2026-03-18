import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronDown, ChevronRight } from "lucide-react-native";

import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { ToolCallInfo } from "../../types";

function formatToolLabel(name: string, args: string): string {
  try {
    const parsed = JSON.parse(args);
    switch (name) {
      case "bash":
        return parsed.command
          ? `$ ${parsed.command.slice(0, 80)}`
          : "bash";
      case "read":
        return parsed.path ?? "read";
      case "edit":
        return parsed.path ?? "edit";
      case "write":
        return parsed.path ?? "write";
      default:
        return name;
    }
  } catch {
    return name;
  }
}

export function ToolCallCard({ toolCall }: { toolCall: ToolCallInfo }) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const [expanded, setExpanded] = useState(false);

  const label = formatToolLabel(toolCall.name, toolCall.arguments);
  const output = toolCall.result ?? toolCall.partialResult;
  const isRunning =
    toolCall.status === "running" ||
    toolCall.status === "streaming" ||
    toolCall.status === "pending";
  const mutedColor = isDark ? "#666" : "#999";

  return (
    <View>
      <Pressable
        style={styles.row}
        onPress={() => output && setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown size={12} color={mutedColor} strokeWidth={1.8} />
        ) : (
          <ChevronRight size={12} color={mutedColor} strokeWidth={1.8} />
        )}
        <Text
          style={[styles.label, { color: mutedColor }]}
          numberOfLines={1}
        >
          {label}
          {isRunning && " …"}
        </Text>
      </Pressable>

      {expanded && output && (
        <View style={styles.output}>
          <Text
            style={[
              styles.outputText,
              {
                color: toolCall.isError
                  ? colors.destructive
                  : isDark
                    ? "#555"
                    : "#888",
              },
            ]}
            selectable
          >
            {output.length > 2000
              ? output.slice(0, 2000) + "\n… truncated"
              : output}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
  },
  label: {
    fontSize: 12,
    fontFamily: Fonts.mono,
    flexShrink: 1,
  },
  output: {
    paddingLeft: 16,
    paddingTop: 4,
    paddingBottom: 2,
    maxHeight: 300,
  },
  outputText: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    lineHeight: 16,
  },
});
