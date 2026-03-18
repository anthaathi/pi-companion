import { StyleSheet, Text, View } from "react-native";
import { History } from "lucide-react-native";

import { Fonts } from "@/constants/theme";
import { timeAgo } from "./constants";
import { useChangesTheme } from "./use-theme-colors";

interface LogEntry {
  hash: string;
  short_hash: string;
  author: string;
  date: string;
  message: string;
}

export function HistoryTab({ entries }: { entries: LogEntry[] }) {
  const { textPrimary, textSecondary, textMuted, dividerColor, hashColor } =
    useChangesTheme();

  if (entries.length === 0) {
    return (
      <View style={styles.cleanState}>
        <History size={20} color={textMuted} strokeWidth={2} />
        <Text style={[styles.emptyText, { color: textMuted }]}>
          No commits yet
        </Text>
      </View>
    );
  }

  return (
    <>
      {entries.map((entry, i) => (
        <View
          key={entry.hash}
          style={[
            styles.logEntry,
            i < entries.length - 1 && {
              borderBottomColor: dividerColor,
              borderBottomWidth: 0.633,
            },
          ]}
        >
          <View style={styles.logHeader}>
            <Text
              style={[styles.logMessage, { color: textPrimary }]}
              numberOfLines={2}
            >
              {entry.message}
            </Text>
          </View>
          <View style={styles.logMeta}>
            <Text style={[styles.logHash, { color: hashColor }]}>
              {entry.short_hash}
            </Text>
            <Text style={[styles.logAuthor, { color: textSecondary }]}>
              {entry.author}
            </Text>
            <Text style={[styles.logDate, { color: textMuted }]}>
              {timeAgo(entry.date)}
            </Text>
          </View>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  cleanState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 48,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: Fonts.sans,
    textAlign: "center",
  },
  logEntry: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  logMessage: {
    fontSize: 13,
    fontFamily: Fonts.sans,
    flex: 1,
    lineHeight: 18,
  },
  logMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  logHash: {
    fontSize: 11,
    fontFamily: Fonts.mono,
  },
  logAuthor: {
    fontSize: 11,
    fontFamily: Fonts.sans,
    flex: 1,
  },
  logDate: {
    fontSize: 11,
    fontFamily: Fonts.sans,
  },
});
