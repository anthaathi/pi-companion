import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ChevronDown, ChevronRight } from "lucide-react-native";

import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { ToolCallInfo } from "../../types";
import { ToolCallCard } from "./tool-call-card";

const MULTI_GROUP_LABELS: Record<string, (n: number) => string> = {
  read: (n) => `Read ${n} files`,
  edit: (n) => `Edited ${n} files`,
  write: (n) => `Wrote ${n} files`,
  bash: (n) => `Ran ${n} commands`,
  python: (n) => `Ran Python ${n} times`,
  search: (n) => `${n} web searches`,
  scrape: (n) => `Scraped ${n} pages`,
  crawl: (n) => `Crawled ${n} sites`,
  subagent: (n) => `Ran ${n} sub-agents`,
};

const SINGLE_VERB: Record<string, string> = {
  read: "Read",
  edit: "Edit",
  write: "Write",
  bash: "$",
  python: "Python",
  search: "Search",
  scrape: "Scrape",
  crawl: "Crawl",
  subagent: "Sub-agent",
};

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

function countLines(text: string): number {
  if (!text) return 0;
  return text.split("\n").length;
}

function formatSingleCall(tc: ToolCallInfo): {
  verb: string;
  detail: string;
  diffAdded?: number;
  diffRemoved?: number;
} {
  const verb = SINGLE_VERB[tc.name] ?? tc.name;
  try {
    const parsed = JSON.parse(tc.arguments);
    switch (tc.name) {
      case "read": {
        const name = parsed.path ? basename(parsed.path) : "";
        const params: string[] = [];
        if (parsed.offset != null) params.push(`offset=${parsed.offset}`);
        if (parsed.limit != null) params.push(`limit=${parsed.limit}`);
        return { verb, detail: params.length ? `${name} ${params.join(" ")}` : name };
      }
      case "edit": {
        const name = parsed.path ? basename(parsed.path) : "";
        const added = countLines(parsed.newText ?? "");
        const removed = countLines(parsed.oldText ?? "");
        return { verb, detail: name, diffAdded: added, diffRemoved: removed };
      }
      case "write": {
        const name = parsed.path ? basename(parsed.path) : "";
        return { verb, detail: name };
      }
      case "bash": {
        const cmd = parsed.command ?? "";
        return { verb, detail: cmd.length > 60 ? cmd.slice(0, 60) + "…" : cmd };
      }
      default:
        return { verb, detail: "" };
    }
  } catch {
    return { verb, detail: "" };
  }
}

function multiGroupLabel(toolName: string, count: number): string {
  const fn = MULTI_GROUP_LABELS[toolName];
  if (fn) return fn(count);
  return `${count}× ${toolName}`;
}

function BashToolCall({ tc }: { tc: ToolCallInfo }) {
  const colorScheme = useColorScheme() ?? "light";
  const isDark = colorScheme === "dark";
  const [expanded, setExpanded] = useState(true);

  let command = "";
  try {
    const parsed = JSON.parse(tc.arguments);
    command = parsed.command ?? "";
  } catch {}

  const output = tc.result ?? tc.partialResult;
  const isRunning = tc.status === "running" || tc.status === "streaming";
  const textColor = isDark ? "#CCCCCC" : "#1A1A1A";
  const mutedColor = isDark ? "#888" : "#888";
  const shortCmd = command.length > 60 ? command.slice(0, 60) + "…" : command;

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  return (
    <View>
      <Pressable style={styles.row} onPress={toggle}>
        <Text style={styles.singleLine} numberOfLines={1}>
          <Text style={[styles.verb, { color: textColor }]}>Shell</Text>
          <Text style={[styles.detail, { color: mutedColor }]}> {shortCmd}</Text>
        </Text>
        {expanded
          ? <ChevronDown size={13} color={mutedColor} strokeWidth={1.8} />
          : <ChevronRight size={13} color={mutedColor} strokeWidth={1.8} />
        }
      </Pressable>

      {expanded && (
        <View style={[bashStyles.box, {
          backgroundColor: isDark ? "#0D0D0D" : "#1A1A1A",
          borderColor: isDark ? "#2A2A2A" : "#333333",
        }]}>
          {output ? (
            <Text
              style={[bashStyles.output, {
                color: tc.isError
                  ? (isDark ? "#F85149" : "#FF6B6B")
                  : (isDark ? "#8B8B8B" : "#AAAAAA"),
              }]}
              selectable
            >
              {output.length > 3000
                ? output.slice(0, 3000) + "\n… truncated"
                : output}
            </Text>
          ) : null}
          {isRunning && !output && (
            <Text style={[bashStyles.output, { color: isDark ? "#8B8B8B" : "#AAAAAA" }]}>Running…</Text>
          )}
        </View>
      )}
    </View>
  );
}

const bashStyles = StyleSheet.create({
  box: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    gap: 6,
  },
  commandLine: {
    fontSize: 13,
    fontFamily: Fonts.mono,
    lineHeight: 20,
  },
  prompt: {
    fontFamily: Fonts.mono,
    fontSize: 13,
  },
  command: {
    fontFamily: Fonts.mono,
    fontSize: 13,
  },
  output: {
    fontSize: 12,
    fontFamily: Fonts.mono,
    lineHeight: 18,
  },
});

function SingleToolCall({ tc }: { tc: ToolCallInfo }) {
  if (tc.name === "bash") {
    return <BashToolCall tc={tc} />;
  }

  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const [expanded, setExpanded] = useState(false);

  const { verb, detail, diffAdded, diffRemoved } = formatSingleCall(tc);
  const output = tc.result ?? tc.partialResult;
  const textColor = isDark ? "#CCCCCC" : "#1A1A1A";
  const mutedColor = isDark ? "#888" : "#888";
  const addColor = isDark ? "#3FB950" : "#1A7F37";
  const removeColor = isDark ? "#F85149" : "#CF222E";

  const toggle = useCallback(() => {
    if (output) setExpanded((v) => !v);
  }, [output]);

  return (
    <View>
      <Pressable style={styles.row} onPress={toggle}>
        <Text style={styles.singleLine} numberOfLines={1}>
          <Text style={[styles.verb, { color: textColor }]}>{verb}</Text>
          {detail ? (
            <Text style={[styles.detail, { color: mutedColor }]}> {detail}</Text>
          ) : null}
          {diffAdded != null && diffRemoved != null ? (
            <>
              <Text style={[styles.diff, { color: addColor }]}> +{diffAdded}</Text>
              <Text style={[styles.diff, { color: removeColor }]}> -{diffRemoved}</Text>
            </>
          ) : null}
        </Text>
      </Pressable>

      {expanded && output && (
        <View style={styles.expandedOutput}>
          <Text
            style={[
              styles.outputText,
              {
                color: tc.isError
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

export function ToolCallGroup({
  toolName,
  calls,
}: {
  toolName: string;
  calls: ToolCallInfo[];
}) {
  const colorScheme = useColorScheme() ?? "light";
  const isDark = colorScheme === "dark";
  const [expanded, setExpanded] = useState(false);
  const textColor = isDark ? "#CCCCCC" : "#1A1A1A";

  if (calls.length === 1) {
    return <SingleToolCall tc={calls[0]} />;
  }

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  return (
    <View>
      <Pressable style={styles.row} onPress={toggle}>
        <Text style={[styles.label, { color: textColor }]}>
          {multiGroupLabel(toolName, calls.length)}
        </Text>
      </Pressable>

      {expanded && (
        <View style={styles.expandedList}>
          {calls.map((tc) => (
            <ToolCallCard key={tc.id} toolCall={tc} />
          ))}
        </View>
      )}
    </View>
  );
}

export interface ToolCallRenderItem {
  key: string;
  toolName: string;
  calls: ToolCallInfo[];
}

const NEVER_GROUP = new Set(["bash"]);

export function groupToolCalls(
  toolCalls: ToolCallInfo[],
): ToolCallRenderItem[] {
  if (toolCalls.length === 0) return [];

  const result: ToolCallRenderItem[] = [];
  const pending = new Map<string, ToolCallRenderItem>();

  for (const tc of toolCalls) {
    if (NEVER_GROUP.has(tc.name)) {
      result.push({
        key: `single-${tc.id}`,
        toolName: tc.name,
        calls: [tc],
      });
    } else {
      const existing = pending.get(tc.name);
      if (existing) {
        existing.calls.push(tc);
      } else {
        const item: ToolCallRenderItem = {
          key: `group-${tc.id}`,
          toolName: tc.name,
          calls: [tc],
        };
        pending.set(tc.name, item);
        result.push(item);
      }
    }
  }

  return result;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.sansBold,
    fontWeight: "bold",
  },
  singleLine: {
    fontSize: 13,
    flexShrink: 1,
  },
  verb: {
    fontFamily: Fonts.sansBold,
    fontWeight: "bold",
    fontSize: 13,
  },
  detail: {
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  diff: {
    fontFamily: Fonts.sansMedium,
    fontWeight: "500",
    fontSize: 12,
  },
  expandedList: {
    paddingLeft: 8,
    paddingTop: 6,
    gap: 4,
  },
  expandedOutput: {
    paddingLeft: 8,
    paddingTop: 8,
    paddingBottom: 4,
    maxHeight: 300,
  },
  outputText: {
    fontSize: 11,
    fontFamily: Fonts.mono,
    lineHeight: 16,
  },
});
